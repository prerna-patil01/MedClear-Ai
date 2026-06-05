import os
import json
import pdfplumber
from openai import OpenAI
from flask import Blueprint, request, jsonify
from io import BytesIO

analyze_bp = Blueprint("analyze", __name__)

client = OpenAI(
    api_key=os.environ.get("OPENROUTER_API_KEY"),
    base_url="https://openrouter.ai/api/v1"
)

ANALYZE_PROMPT = """
You are MedClear, a compassionate medical report interpreter.
Your job is to explain medical reports in simple, reassuring plain language — not to diagnose or treat.

Analyze the report and respond ONLY with a valid JSON object (no markdown, no backticks, no extra text) with this exact structure:
{
  "title": "short descriptive title like 'Complete Blood Count Analysis'",
  "summary": "2-3 sentence plain-English overview of the overall picture. Be warm and clear.",
  "risk": {
    "level": "low|moderate|high",
    "score": <integer 0-100>,
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
}
"""

def extract_pdf_text(file_bytes):
    try:
        with pdfplumber.open(BytesIO(file_bytes)) as pdf:
            text = ""
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text.strip()
    except Exception:
        return None


@analyze_bp.route("/api/analyze", methods=["POST"])
def analyze():
    report_text = ""

    if "file" in request.files:
        f = request.files["file"]

        if f.filename.lower().endswith(".pdf"):
            pdf_text = extract_pdf_text(f.read())

            if not pdf_text:
                return jsonify({
                    "error": "Could not extract text from this PDF. Please try a text-based PDF or paste the text manually."
                }), 422

            report_text = pdf_text

        else:
            try:
                report_text = f.read().decode("utf-8", errors="replace")
            except Exception:
                return jsonify({
                    "error": "Could not read the uploaded file."
                }), 422

    elif request.is_json:
        data = request.get_json(silent=True) or {}
        report_text = data.get("text", "").strip()

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

    try:
        prompt = f"{ANALYZE_PROMPT}\n\nAnalyze this medical report:\n\n{report_text[:4000]}"

        print("=== DEBUG ===")
        print("API KEY EXISTS:", bool(os.environ.get("OPENROUTER_API_KEY")))

        key = os.environ.get("OPENROUTER_API_KEY")
        if key:
            print("KEY PREFIX:", key[:10])

        print("MODEL:", "mistralai/mistral-7b-instruct:free")
        print("============")

        response = client.chat.completions.create(
            model="mistralai/mistral-7b-instruct:free",
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3
        )

        if not response.choices:
            return jsonify({
                "error": "No response received from AI model."
            }), 500

        raw = (response.choices[0].message.content or "").strip()

        if not raw:
            return jsonify({
                "error": "AI returned an empty response."
            }), 500

        if raw.startswith("```"):
            raw = raw.replace("```json", "")
            raw = raw.replace("```", "")
            raw = raw.strip()

        try:
            result = json.loads(raw)
        except Exception:
            print("===== RAW AI RESPONSE =====")
            print(raw)
            print("===========================")

            return jsonify({
                "error": "Model returned invalid JSON",
                "raw_response": raw[:1000]
            }), 500

        return jsonify(result)

    except Exception as e:
        import traceback

        print("===== ANALYZE ERROR =====")
        traceback.print_exc()
        print("=========================")

        return jsonify({
            "error": str(e)
        }), 500
