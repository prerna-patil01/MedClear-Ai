import os
import json
import re
import pdfplumber
from openai import OpenAI
from flask import Blueprint, request, jsonify
from io import BytesIO

analyze_bp = Blueprint("analyze", __name__)

# ---------------------------------------------------------------------------
# OpenRouter client
# ---------------------------------------------------------------------------
client = OpenAI(
    api_key=os.environ.get("OPENROUTER_API_KEY"),
    base_url="https://openrouter.ai/api/v1",
)

# ---------------------------------------------------------------------------
# Free-tier model cascade (tried in order until one succeeds).
# As of June 2026 these are confirmed free on OpenRouter.
# Ordered: best instruction-following first.
# ---------------------------------------------------------------------------
FREE_MODEL_CASCADE = [
    "meta-llama/llama-3.3-70b-instruct:free",   # 131K ctx, tools
    "nvidia/nemotron-3-super-120b-a12b:free",    # 1M ctx, tools
    "google/gemma-4-31b-it:free",                # 262K ctx, vision+tools
    "nousresearch/hermes-3-llama-3.1-405b:free", # 131K ctx
    "qwen/qwen3-coder:free",                     # 1M ctx, tools (good at JSON)
]

# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------
ANALYZE_PROMPT = """You are MedClear, a compassionate medical report interpreter.
Your job is to explain medical reports in simple, reassuring plain language — not to diagnose or treat.

Analyze the report and respond ONLY with a valid JSON object.
No markdown, no backticks, no explanation before or after. Just the JSON.

Use this EXACT structure:
{
  "title": "short descriptive title like 'Complete Blood Count Analysis'",
  "summary": "2-3 sentence plain-English overview of the overall picture. Be warm and clear.",
  "risk": {
    "level": "low|moderate|high",
    "score": 0,
    "reason": "1 sentence explaining the risk level based on findings"
  },
  "findings": [
    {
      "name": "Test or Parameter Name",
      "value": "measured value with unit",
      "reference": "normal range",
      "status": "normal|high|low|info",
      "explanation": "1-2 sentences in plain English what this means for the patient"
    }
  ],
  "questions": [
    "Specific question the patient should ask their doctor"
  ],
  "lifestyle": [
    {
      "category": "Diet|Exercise|Sleep|Hydration|Stress|Other",
      "icon": "🥗|🏃|😴|💧|🧘|✨",
      "suggestion": "One specific, actionable suggestion based on the findings"
    }
  ],
  "specialists": ["Cardiologist"]
}"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def extract_pdf_text(file_bytes: bytes) -> str | None:
    try:
        with pdfplumber.open(BytesIO(file_bytes)) as pdf:
            pages = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
            return "\n".join(pages).strip() or None
    except Exception as exc:
        print("PDF EXTRACTION ERROR:", exc)
        return None


def clean_json_response(raw: str) -> str:
    """Strip markdown fences and leading/trailing garbage."""
    # Remove ```json ... ``` or ``` ... ```
    raw = re.sub(r"```(?:json)?", "", raw)
    raw = raw.replace("```", "")
    # Find the first { and last } to isolate JSON
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        return raw[start : end + 1].strip()
    return raw.strip()


def call_model(prompt: str) -> dict:
    """Try each model in cascade; return parsed JSON or raise."""
    last_error = None

    for model_id in FREE_MODEL_CASCADE:
        print(f"[ANALYZE] Trying model: {model_id}")
        try:
            response = client.chat.completions.create(
                model=model_id,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=2000,
            )

            if not response.choices:
                print(f"[ANALYZE] No choices returned by {model_id}")
                continue

            raw = (response.choices[0].message.content or "").strip()
            if not raw:
                print(f"[ANALYZE] Empty response from {model_id}")
                continue

            cleaned = clean_json_response(raw)
            result = json.loads(cleaned)

            # Basic sanity check — must have at minimum title + summary
            if "title" in result and "summary" in result:
                print(f"[ANALYZE] Success with {model_id}")
                return result

            print(f"[ANALYZE] Response from {model_id} missing required keys")

        except json.JSONDecodeError as jde:
            print(f"[ANALYZE] JSON parse error from {model_id}: {jde}")
            print(f"[ANALYZE] Raw snippet: {raw[:300]}")
            last_error = f"Model {model_id} returned invalid JSON"
        except Exception as exc:
            err_str = str(exc)
            print(f"[ANALYZE] Error with {model_id}: {err_str}")
            # Skip to next model for endpoint errors, quota, etc.
            last_error = err_str
            if "No endpoints found" in err_str or "404" in err_str:
                continue
            # For auth errors, stop trying immediately
            if "401" in err_str or "403" in err_str:
                raise

    raise RuntimeError(
        last_error or "All models in cascade failed to return a valid response."
    )


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@analyze_bp.route("/api/analyze", methods=["POST"])
def analyze():
    report_text = ""

    # --- File upload ---
    if "file" in request.files:
        f = request.files["file"]

        if f.filename.lower().endswith(".pdf"):
            pdf_text = extract_pdf_text(f.read())
            if not pdf_text:
                return jsonify({
                    "error": (
                        "Could not extract text from this PDF. "
                        "Please try a text-based PDF or paste the text manually."
                    )
                }), 422
            report_text = pdf_text

        else:
            try:
                report_text = f.read().decode("utf-8", errors="replace")
            except Exception:
                return jsonify({"error": "Could not read the uploaded file."}), 422

    # --- JSON body ---
    elif request.is_json:
        data = request.get_json(silent=True) or {}
        report_text = data.get("text", "").strip()

    # --- Form data ---
    else:
        report_text = (request.form.get("text") or "").strip()

    if not report_text:
        return jsonify({
            "error": "No report content provided. Please upload a file or paste your report text."
        }), 400

    if len(report_text) < 20:
        return jsonify({
            "error": "Report text is too short. Please provide more content."
        }), 400

    # --- Debug ---
    key = os.environ.get("OPENROUTER_API_KEY", "")
    print("=== ANALYZE DEBUG ===")
    print("API KEY EXISTS:", bool(key))
    if key:
        print("KEY PREFIX:", key[:12])
    print("TEXT LENGTH:", len(report_text))
    print("=====================")

    # --- Call LLM ---
    try:
        prompt = f"{ANALYZE_PROMPT}\n\nAnalyze this medical report:\n\n{report_text[:4000]}"
        result = call_model(prompt)
        return jsonify(result)

    except Exception as e:
        import traceback
        print("===== ANALYZE ERROR =====")
        traceback.print_exc()
        print("=========================")
        return jsonify({"error": str(e)}), 500
