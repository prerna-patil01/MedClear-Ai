import os
import json
import pdfplumber
import io
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

app = Flask(__name__)
CORS(app)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

SYSTEM_PROMPT = """You are MedClear, a compassionate medical report interpreter.
Your job is to explain medical reports in simple, reassuring plain language — not to diagnose or treat.

Analyze the report and respond ONLY with a valid JSON object (no markdown, no backticks, no extra text) with this exact structure:
{
  "title": "short descriptive title like 'Complete Blood Count Analysis'",
  "summary": "2-3 sentence plain-English overview of the overall picture. Be warm and clear.",
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
    "Another specific question"
  ]
}

Rules:
- findings array: 3-8 items covering the most important values
- questions array: 4-6 specific, useful questions
- status must be exactly one of: normal, high, low, or info
- If a value has no reference range, use status "info"
- Never say "consult a doctor" in the summary — the disclaimer handles that
- Tone: calm, clear, supportive — like a knowledgeable friend
- For prescriptions or discharge summaries without specific values, create info-type findings explaining each medication/instruction
- Return ONLY the JSON object. No markdown. No backticks. No explanation before or after."""


def extract_text_from_pdf(file_bytes):
    text = ""
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text.strip()


def parse_gemini_response(raw_text):
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()
    return json.loads(cleaned)


def validate_response(data):
    if not isinstance(data, dict):
        raise ValueError("Response is not a JSON object")
    if "title" not in data or not isinstance(data["title"], str):
        raise ValueError("Missing or invalid 'title'")
    if "summary" not in data or not isinstance(data["summary"], str):
        raise ValueError("Missing or invalid 'summary'")
    if "findings" not in data or not isinstance(data["findings"], list):
        raise ValueError("Missing or invalid 'findings'")
    if "questions" not in data or not isinstance(data["questions"], list):
        raise ValueError("Missing or invalid 'questions'")

    valid_statuses = {"normal", "high", "low", "info"}
    for i, finding in enumerate(data["findings"]):
        if not isinstance(finding, dict):
            raise ValueError(f"Finding {i} is not an object")
        for field in ["name", "value", "reference", "status", "explanation"]:
            if field not in finding:
                finding[field] = ""
        if finding["status"] not in valid_statuses:
            finding["status"] = "info"

    return data


@app.route("/analyze", methods=["POST"])
def analyze():
    report_text = ""

    # ── Handle multipart (file upload) ──
    if request.content_type and "multipart/form-data" in request.content_type:
        file = request.files.get("file")
        if file:
            file_bytes = file.read()
            filename = file.filename.lower()
            if filename.endswith(".pdf"):
                try:
                    report_text = extract_text_from_pdf(file_bytes)
                except Exception:
                    return jsonify({"error": "Failed to extract text from PDF."}), 422
            else:
                try:
                    report_text = file_bytes.decode("utf-8")
                except UnicodeDecodeError:
                    return jsonify({"error": "Could not read file. Please use a PDF or plain text file."}), 422
        else:
            report_text = request.form.get("report", "").strip()

    # ── Handle JSON body ──
    else:
        body = request.get_json(silent=True)
        if not body:
            return jsonify({"error": "Invalid request body."}), 400
        report_text = body.get("report", "").strip()

    if not report_text:
        return jsonify({"error": "No report text provided."}), 400

    if len(report_text) > 20000:
        return jsonify({"error": "Report is too long. Please limit to 20,000 characters."}), 413

    # ── Call Gemini ──
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(
    f"""
{SYSTEM_PROMPT}

Medical Report:
{report_text}

Remember:
Return ONLY valid JSON.
Do not add explanations.
Do not use markdown.
Do not wrap JSON in backticks.
""",
    generation_config=genai.types.GenerationConfig(
        temperature=0.0,
        max_output_tokens=4000,
    )
)
        raw_text = response.text
        print("\n===== RAW GEMINI RESPONSE =====")
        print(raw_text)
    except Exception as e:
        print("\n===== GEMINI ERROR =====")
        print(repr(e))
        return jsonify({"error": str(e) }), 502

    # ── Parse response ──
    # ── Parse response ──
    try:
        parsed = parse_gemini_response(raw_text)

    except json.JSONDecodeError:
        print("\n===== JSON PARSE FAILED =====")
        print(raw_text)

        return jsonify({
            "error": "AI returned malformed JSON.",
            "raw": raw_text
        }), 502

    # ── Validate structure ──
    try:
        validated = validate_response(parsed)
    except ValueError as e:
        return jsonify({"error": f"AI response validation failed: {str(e)}"}), 502

    return jsonify(validated), 200


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":

    port = int(os.environ.get("PORT", 5000))

    app.run(host="0.0.0.0", port=port)