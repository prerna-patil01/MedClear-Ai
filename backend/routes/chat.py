import os
from openai import OpenAI
from flask import Blueprint, request, jsonify

chat_bp = Blueprint("chat", __name__)

client = OpenAI(
    api_key=os.environ.get("OPENROUTER_API_KEY"),
    base_url="https://openrouter.ai/api/v1"
)

MEDDIE_SYSTEM = """
You are Meddie, a warm and knowledgeable AI health companion for MedClear.

You have been given the user's analyzed medical report as context.

Your role is to help the user understand their report in plain, compassionate language.

Guidelines:
- Always refer to the actual values from the provided report context when answering
- Be warm, supportive, and clear
- Never diagnose or prescribe medications
- Encourage users to discuss findings with their doctor
- Keep answers concise (3-5 sentences)
- If asked something outside the report, answer briefly
- If the user seems worried, be reassuring but honest
- End serious answers with:
  "Your doctor can give you the most accurate guidance on this."
"""


@chat_bp.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json(silent=True)

        if not data:
            return jsonify({"error": "Invalid request body."}), 400

        user_message = (data.get("message") or "").strip()
        report_context = data.get("context") or {}
        history = data.get("history") or []

        if not user_message:
            return jsonify({"error": "Message cannot be empty."}), 400

        context_parts = []

        if report_context:
            context_parts.append(
                f"REPORT TITLE: {report_context.get('title', 'Medical Report')}"
            )

            context_parts.append(
                f"SUMMARY: {report_context.get('summary', '')}"
            )

            findings = report_context.get("findings", [])

            if findings:
                context_parts.append("FINDINGS:")

                for f in findings:
                    context_parts.append(
                        f"- {f.get('name')}: {f.get('value')} "
                        f"(ref: {f.get('reference')}) "
                        f"Status: {f.get('status')}"
                    )

            risk = report_context.get("risk", {})

            if risk:
                context_parts.append(
                    f"RISK LEVEL: {risk.get('level')} "
                    f"(score: {risk.get('score')})"
                )

        context_str = "\n".join(context_parts)

        messages = [
            {
                "role": "system",
                "content": MEDDIE_SYSTEM
            }
        ]

        for msg in history[-10:]:
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })

        messages.append({
            "role": "user",
            "content": f"""
PATIENT REPORT:

{context_str}

USER QUESTION:

{user_message}
"""
        })

        response = client.chat.completions.create(
            model="meta-llama/llama-3.3-70b-instruct:free",
            messages=messages,
            temperature=0.4
        )

        reply = response.choices[0].message.content.strip()

        return jsonify({
            "response": reply
        })

    except Exception as e:
        print("CHAT ERROR:", str(e))

        if "429" in str(e):
            return jsonify({
                "error": "Rate limit reached. Please wait a moment."
            }), 429

        return jsonify({
            "error": str(e)
        }), 500
