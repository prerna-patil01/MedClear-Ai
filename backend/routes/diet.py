from flask import Blueprint, request, jsonify
from extensions import limiter
import os
import json
import requests

diet_bp = Blueprint("diet", __name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

SYSTEM_PROMPT = """You are a certified clinical nutritionist and dietitian AI working within MedClear, a medical report analysis platform.

Your role is to generate a personalized, medically-informed diet plan based on a patient's medical report findings.

IMPORTANT RULES:
- Always base recommendations on the actual findings provided
- Be specific (include actual foods, quantities where helpful)
- Highlight foods to AVOID based on their conditions
- Structure response as strict JSON only — no markdown, no preamble, no backticks
- All recommendations must be safe, evidence-based, and conservative
- Always recommend consulting a registered dietitian/doctor for personalized advice

Return ONLY valid JSON in this exact structure (no extra text before or after):
{
  "title": "Personalized Diet Plan for [condition focus]",
  "summary": "2-3 sentence overview of the diet approach based on findings",
  "duration": "4-week plan",
  "calories_range": "1800–2200 kcal/day",
  "conditions_addressed": ["condition1", "condition2"],
  "meals": {
    "breakfast": {
      "suggestions": ["option 1 with portion", "option 2 with portion", "option 3 with portion"],
      "avoid": ["item1", "item2"]
    },
    "lunch": {
      "suggestions": ["option 1 with portion", "option 2 with portion", "option 3 with portion"],
      "avoid": ["item1", "item2"]
    },
    "dinner": {
      "suggestions": ["option 1 with portion", "option 2 with portion", "option 3 with portion"],
      "avoid": ["item1", "item2"]
    },
    "snacks": {
      "suggestions": ["option 1", "option 2", "option 3"],
      "avoid": ["item1", "item2"]
    }
  },
  "nutrients_to_prioritize": [
    {"nutrient": "Iron", "reason": "why", "sources": ["spinach", "lentils"]},
    {"nutrient": "Vitamin C", "reason": "why", "sources": ["oranges", "bell peppers"]}
  ],
  "nutrients_to_limit": [
    {"nutrient": "Sodium", "reason": "why", "limit": "< 2g/day"},
    {"nutrient": "Saturated Fat", "reason": "why", "limit": "< 7% of calories"}
  ],
  "hydration": {
    "target": "2.5–3 liters/day",
    "tips": ["tip1", "tip2"]
  },
  "lifestyle_tips": ["tip1", "tip2", "tip3"],
  "foods_to_avoid": ["food1 - reason", "food2 - reason", "food3 - reason"],
  "sample_day": {
    "breakfast": "Specific meal description",
    "mid_morning": "Specific snack",
    "lunch": "Specific meal description",
    "evening": "Specific snack",
    "dinner": "Specific meal description"
  },
  "disclaimer": "This diet plan is for educational purposes only. Please consult a registered dietitian or your doctor before making significant dietary changes."
}"""


def extract_findings_text(analysis: dict) -> str:
    parts = []

    if analysis.get("title"):
        parts.append(f"Report: {analysis['title']}")

    if analysis.get("summary"):
        parts.append(f"Summary: {analysis['summary']}")

    if analysis.get("risk"):
        risk = analysis["risk"]
        parts.append(f"Risk Level: {risk.get('level', 'unknown')} — {risk.get('reason', '')}")

    findings = analysis.get("findings", [])
    if findings:
        parts.append("Findings:")
        for f in findings:
            name   = f.get("name") or f.get("test", "")
            value  = f.get("value") or f.get("result", "")
            status = f.get("status", "")
            ref    = f.get("reference", "")
            parts.append(f"  - {name}: {value} ({status}) [ref: {ref}]")

    specialists = analysis.get("specialists", [])
    if specialists:
        parts.append(f"Specialists recommended: {', '.join(specialists)}")

    lifestyle = analysis.get("lifestyle", [])
    if lifestyle:
        parts.append("Existing lifestyle notes:")
        for item in lifestyle:
            if isinstance(item, dict):
                parts.append(f"  - {item.get('category', '')}: {item.get('suggestion', '')}")
            else:
                parts.append(f"  - {item}")

    return "\n".join(parts)


@diet_bp.route("/api/diet", methods=["POST"])
@limiter.limit("5 per minute")
def get_diet_plan():
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Invalid request."}), 400

        analysis = data.get("analysis")
        if not analysis:
            return jsonify({"error": "Medical analysis data is required."}), 400

        findings_text = extract_findings_text(analysis)
        if not findings_text.strip():
            return jsonify({"error": "No findings found in the analysis."}), 400

        groq_api_key = os.environ.get("GROQ_API_KEY")
        if not groq_api_key:
            return jsonify({"error": "Groq API key not configured."}), 500

        user_message = f"""Based on the following medical report findings, create a comprehensive personalized diet plan:

{findings_text}

Generate a detailed, actionable diet plan that directly addresses the specific conditions and values found in this report. Be specific with food recommendations and portions. Return ONLY valid JSON, no markdown, no backticks."""

        response = requests.post(
            GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {groq_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": user_message},
                ],
                "max_tokens": 2000,
                "temperature": 0.4,
            },
            timeout=60,
        )

        if response.status_code != 200:
            print(f"[DIET] Groq error {response.status_code}: {response.text[:300]}")
            return jsonify({"error": "AI service error. Please try again."}), 503

        result      = response.json()
        raw_text    = result["choices"][0]["message"]["content"].strip()

        # Strip markdown fences if model added them anyway
        if raw_text.startswith("```"):
            lines    = raw_text.split("\n")
            raw_text = "\n".join(lines[1:])
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3].strip()

        try:
            diet_plan = json.loads(raw_text)
        except json.JSONDecodeError as e:
            print(f"[DIET] JSON parse error: {e}")
            print(f"[DIET] Raw: {raw_text[:400]}")
            return jsonify({"error": "Failed to parse diet plan. Please try again."}), 500

        return jsonify({"diet_plan": diet_plan})

    except requests.exceptions.Timeout:
        return jsonify({"error": "Request timed out. Please try again."}), 504
    except requests.exceptions.RequestException as e:
        print(f"[DIET] Request error: {e}")
        return jsonify({"error": "Network error. Please try again."}), 503
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
