import os
import json
import re
import base64
import io
import pdfplumber
import requests as http_requests
from PIL import Image
from openai import OpenAI
from flask import Blueprint, request, jsonify
from extensions import limiter

analyze_bp = Blueprint("analyze", __name__)

# ─── Groq (primary) ─────────────────────────────────────────────────────────
GROQ_KEY = os.environ.get("GROQ_API_KEY", "")
groq = OpenAI(api_key=GROQ_KEY, base_url="https://api.groq.com/openai/v1")

# ─── OpenRouter (fallback) ───────────────────────────────────────────────────
OR_KEY = os.environ.get("OPENROUTER_API_KEY", "")
openrouter = OpenAI(api_key=OR_KEY, base_url="https://openrouter.ai/api/v1")

# ─── Groq text model cascade ────────────────────────────────────────────────
GROQ_TEXT_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "mixtral-8x7b-32768",
    "llama-3.1-8b-instant",
    "gemma2-9b-it",
]

# ─── Groq vision model cascade ──────────────────────────────────────────────
GROQ_VISION_MODELS = [
    "llama-3.2-11b-vision-preview",
    "llama-3.2-90b-vision-preview",
]

# ─── Accepted image extensions ──────────────────────────────────────────────
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif"}
IMAGE_MIME = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".png": "image/png",  ".webp": "image/webp",
    ".bmp": "image/bmp",  ".tiff": "image/jpeg", ".tif": "image/jpeg",
}

# ─── System prompt ──────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are MedClear, a compassionate AI medical report interpreter for a patient-facing application.

Your ONLY output must be a single valid JSON object. No markdown, no fences, no text before or after.

Required JSON structure (use exactly these keys):
{
  "title": "short descriptive title e.g. Complete Blood Count Analysis",
  "summary": "2-3 sentence plain-English overview. Warm, clear, non-alarming.",
  "risk": {
    "level": "low OR moderate OR high",
    "score": <integer 1 to 10>,
    "reason": "one sentence explaining the risk level"
  },
  "findings": [
    {
      "name": "Test or Parameter Name",
      "value": "measured value with unit",
      "reference": "normal range e.g. 70-100 mg/dL",
      "status": "normal OR high OR low OR info",
      "explanation": "1-2 sentences in plain English what this result means for the patient"
    }
  ],
  "questions": [
    "Specific question the patient should ask their doctor"
  ],
  "lifestyle": [
    {
      "category": "Diet OR Exercise OR Sleep OR Hydration OR Stress OR Other",
      "icon": "🥗 OR 🏃 OR 😴 OR 💧 OR 🧘 OR ✨",
      "suggestion": "One specific actionable suggestion directly related to the findings"
    }
  ],
  "specialists": ["Specialist type e.g. Cardiologist"]
}

Rules:
- Never diagnose. Never prescribe medication.
- Include ALL key values from the report in findings, even normal ones.
- risk.score: 1-3 = low, 4-6 = moderate, 7-10 = high.
- specialists must be directly relevant to actual findings in this report.
- questions must reference the specific values found.
- If the report is an image, extract all visible medical values first, then analyze them."""


# ─── Helpers ────────────────────────────────────────────────────────────────

def extract_pdf_text(file_bytes: bytes) -> str | None:
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages = [p.extract_text() for p in pdf.pages if p.extract_text()]
            return "\n".join(pages).strip() or None
    except Exception as exc:
        print(f"[PDF] extraction error: {exc}")
        return None


def prepare_image(file_bytes: bytes, ext: str) -> tuple[str, str]:
    """Resize image if needed, return (base64_string, mime_type)."""
    mime = IMAGE_MIME.get(ext, "image/jpeg")
    try:
        img = Image.open(io.BytesIO(file_bytes))
        # Convert RGBA/LA to RGB for JPEG compatibility
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGB")
        # Resize if too large (vision models work best up to ~1920px)
        max_px = 1920
        if img.width > max_px or img.height > max_px:
            img.thumbnail((max_px, max_px), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        file_bytes = buf.getvalue()
        mime = "image/jpeg"
    except Exception as exc:
        print(f"[IMAGE] resize error: {exc}")
    b64 = base64.b64encode(file_bytes).decode("utf-8")
    return b64, mime


def clean_json(raw: str) -> str:
    """Strip markdown fences and isolate the JSON object."""
    raw = re.sub(r"```(?:json)?", "", raw).replace("```", "")
    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end > start:
        return raw[start:end + 1].strip()
    return raw.strip()


def validate_response(obj: dict) -> bool:
    return isinstance(obj, dict) and "title" in obj and "summary" in obj


def get_openrouter_free_models() -> list[str]:
    """Dynamically fetch current free models from OpenRouter — never hardcodes stale IDs."""
    if not OR_KEY:
        return []
    try:
        resp = http_requests.get(
            "https://openrouter.ai/api/v1/models",
            headers={"Authorization": f"Bearer {OR_KEY}"},
            timeout=8,
        )
        models = resp.json().get("data", [])
        free = []
        for m in models:
            pricing = m.get("pricing", {})
            cost = str(pricing.get("prompt", "1")).strip()
            if cost in ("0", "0.0", "0.00"):
                free.append(m["id"])
        print(f"[OR] Found {len(free)} free models dynamically")
        return free[:5]
    except Exception as exc:
        print(f"[OR] Failed to fetch models: {exc}")
        return []


# ─── Core LLM callers ───────────────────────────────────────────────────────

def call_text_model(prompt_text: str) -> dict:
    """Try Groq text models in cascade, then OpenRouter as final fallback."""
    last_err = None

    # --- Groq ---
    for model in GROQ_TEXT_MODELS:
        print(f"[ANALYZE] Groq text: {model}")
        try:
            resp = groq.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": prompt_text},
                ],
                temperature=0.2,
                max_tokens=2500,
            )
            raw = (resp.choices[0].message.content or "").strip()
            if not raw:
                continue
            obj = json.loads(clean_json(raw))
            if validate_response(obj):
                print(f"[ANALYZE] Groq success: {model}")
                return obj
        except json.JSONDecodeError as e:
            print(f"[ANALYZE] JSON error from {model}: {e}")
            last_err = str(e)
        except Exception as e:
            err = str(e)
            print(f"[ANALYZE] Error from {model}: {err}")
            last_err = err
            if "401" in err or "403" in err:
                break  # auth error — stop trying Groq

    # --- OpenRouter fallback ---
    if OR_KEY:
        free_models = get_openrouter_free_models()
        for model in free_models:
            print(f"[ANALYZE] OpenRouter fallback: {model}")
            try:
                resp = openrouter.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user",   "content": prompt_text},
                    ],
                    temperature=0.2,
                    max_tokens=2500,
                    extra_headers={
                        "HTTP-Referer": "https://med-clear-ai.vercel.app",
                        "X-Title": "MedClear AI",
                    },
                )
                raw = (resp.choices[0].message.content or "").strip()
                if not raw:
                    continue
                obj = json.loads(clean_json(raw))
                if validate_response(obj):
                    print(f"[ANALYZE] OpenRouter success: {model}")
                    return obj
            except Exception as e:
                print(f"[ANALYZE] OpenRouter error {model}: {e}")
                last_err = str(e)

    raise RuntimeError(last_err or "All models failed to return a valid response.")


def call_vision_model(b64_image: str, mime: str) -> dict:
    """Send image to Groq vision model for OCR + analysis."""
    data_url = f"data:{mime};base64,{b64_image}"
    last_err = None

    for model in GROQ_VISION_MODELS:
        print(f"[ANALYZE] Groq vision: {model}")
        try:
            resp = groq.chat.completions.create(
                model=model,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": data_url},
                        },
                        {
                            "type": "text",
                            "text": (
                                SYSTEM_PROMPT
                                + "\n\nThe image above contains a medical report or lab results. "
                                "Extract all visible values and analyze them. "
                                "Return ONLY the JSON object."
                            ),
                        },
                    ],
                }],
                temperature=0.2,
                max_tokens=2500,
            )
            raw = (resp.choices[0].message.content or "").strip()
            if not raw:
                continue
            obj = json.loads(clean_json(raw))
            if validate_response(obj):
                print(f"[ANALYZE] Vision success: {model}")
                return obj
        except json.JSONDecodeError as e:
            print(f"[ANALYZE] Vision JSON error {model}: {e}")
            last_err = str(e)
        except Exception as e:
            print(f"[ANALYZE] Vision error {model}: {e}")
            last_err = str(e)

    raise RuntimeError(last_err or "Vision models failed. Try pasting the text instead.")


# ─── Route ──────────────────────────────────────────────────────────────────

@analyze_bp.route("/api/analyze", methods=["POST"])
@limiter.limit("8 per minute")
def analyze():
    report_text = ""
    is_image = False
    image_b64 = None
    image_mime = None

    # --- File upload ---
    if "file" in request.files:
        f = request.files["file"]
        filename = (f.filename or "").lower()
        ext = os.path.splitext(filename)[1]
        file_bytes = f.read()

        if ext == ".pdf":
            extracted = extract_pdf_text(file_bytes)
            if not extracted:
                return jsonify({
                    "error": (
                        "Could not extract text from this PDF. "
                        "It may be scanned or image-based. "
                        "Try uploading a photo of the report or paste the text."
                    )
                }), 422
            report_text = extracted

        elif ext in IMAGE_EXTENSIONS:
            is_image = True
            image_b64, image_mime = prepare_image(file_bytes, ext)

        elif ext in (".txt", ".csv", ""):
            try:
                report_text = file_bytes.decode("utf-8", errors="replace")
            except Exception:
                return jsonify({"error": "Could not read the uploaded file."}), 422

        else:
            return jsonify({
                "error": f"Unsupported file type '{ext}'. Upload PDF, image (JPG/PNG/WEBP), or TXT."
            }), 422

    # --- JSON body ---
    elif request.is_json:
        data = request.get_json(silent=True) or {}
        report_text = data.get("text", "").strip()

    # --- Form data ---
    else:
        report_text = (request.form.get("text") or "").strip()

    # --- Validate ---
    if not is_image and not report_text:
        return jsonify({
            "error": "No report content provided. Upload a file or paste your report text."
        }), 400

    if not is_image and len(report_text) < 20:
        return jsonify({"error": "Report text is too short. Please provide more content."}), 400

    print(f"[ANALYZE] GROQ_KEY present: {bool(GROQ_KEY)} | is_image: {is_image} | text_len: {len(report_text)}")

    # --- Call LLM ---
    try:
        if is_image:
            result = call_vision_model(image_b64, image_mime)
        else:
            # Use up to 20,000 chars — enough for the longest lab reports
            prompt = f"Analyze this medical report:\n\n{report_text[:20000]}"
            result = call_text_model(prompt)

        return jsonify(result)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
