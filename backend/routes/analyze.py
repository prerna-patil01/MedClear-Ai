import os
import json
import pdfplumber
import google.generativeai as genai
from flask import Blueprint, request, jsonify
from io import BytesIO

analyze_bp = Blueprint("analyze", __name__)

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.5-flash")

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
    "Specific question the patient should ask their doctor",
    "..."
  ],
  "lifestyle": [
    {
      "category": "Diet|Exercise|Sleep|Hydration|Stress|Other",
      "icon": "🥗|🏃|😴|💧|🧘|✨",
      "suggestion": "One specific, actionable suggestion based on the findings"
    }
  ],
  "specialists": ["Cardiologist", "Endocrinologist"]
}

Rules:
- findings: 3-8 items covering the most important values
- questions: 4-6 specific, useful questions
- lifestyle: 4-6 personalized suggestions based on actual findings
- specialists: 1-3 relevant specialist types inferred from findings
- risk.score: 0-30 = low, 31-60 = moderate, 61-100 = high
- status must be exactly: normal, high, low, or info
- If a value has no reference range, use status "info"
- Tone: calm, clear, supportive
- For prescriptions without specific values, create info-type findings
- Never say "consult a doctor" in the summary
"""

def extract_pdf_text(file_bytes):
    """Extract text from PDF bytes using pdfplumber."""
    try:
        with pdfplumber.open(BytesIO(file_bytes)) as pdf:
            text = ""
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text.strip()
    except Exception as e:
        return None

@analyze_bp.route("/api/analyze", methods=["POST"])
def analyze():
    report_text = ""

    # Handle PDF upload
    if "file" in request.files:
        f = request.files["file"]
        if f.filename.lower().endswith(".pdf"):
            pdf_text = extract_pdf_text(f.read())
            if not pdf_text:
                return jsonify({"error": "Could not extract text from this PDF. Please try a text-based PDF or paste the text manually."}), 422
            report_text = pdf_text
        else:
            # Plain text file
            try:
                report_text = f.read().decode("utf-8", errors="replace")
            except Exception:
                return jsonify({"error": "Could not read the uploaded file."}), 422

    # Handle JSON body with text
    elif request.is_json:
        data = request.get_json(silent=True) or {}
        report_text = data.get("text", "").strip()
    else:
        report_text = (request.form.get("text") or "").strip()

    if not report_text:
        return jsonify({"error": "No report content provided. Please upload a file or paste your report text."}), 400

    if len(report_text) < 20:
        return jsonify({"error": "Report text is too short. Please provide more content."}), 400

    try:
        prompt = f"{ANALYZE_PROMPT}\n\nAnalyze this medical report:\n\n{report_text[:8000]}"
        response = model.generate_content(prompt)
        raw = response.text.strip()

        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        result = json.loads(raw)
        return jsonify(result)

    except json.JSONDecodeError:
        return jsonify({"error": "AI returned an unexpected format. Please try again."}), 500
    except Exception as e:
        import traceback
    
        print("===== ANALYZE ERROR =====")
        traceback.print_exc()
        print("=========================")
    
        return jsonify({
            "error": str(e)
        }), 500
