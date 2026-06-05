import os
from openai import OpenAI
from flask import Blueprint, request, jsonify

chat_bp = Blueprint("chat", __name__)

client = OpenAI(
    api_key=os.environ.get("OPENROUTER_API_KEY"),
    base_url="https://openrouter.ai/api/v1",
)

# Same cascade as analyze — try in order
CHAT_MODEL_CASCADE = [
    "meta-llama/llama-3.3-70b-instruct:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "google/gemma-4-31b-it:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "qwen/qwen3-coder:free",
]

MEDDIE_SYSTEM = """You are Meddie, a warm and knowledgeable AI health companion for MedClear.

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
- End serious answers with: "Your doctor can give you the most accurate guidance on this."
"""


def build_context_string(report_context) -> str:
    if isinstance(report_context, str):
        return report_context

    if isinstance(report_context, dict):
        parts = []
        parts.append(f"REPORT TITLE: {report_context.get('title', 'Medical Report')}")
        parts.append(f"SUMMARY: {report_context.get('summary', '')}")

        findings = report_context.get("findings", [])
        if findings:
            parts.append("FINDINGS:")
            for f in findings:
                parts.append(
                    f"- {f.get('name')}: {f.get('value')} "
                    f"(ref: {f.get('reference')}) "
                    f"Status: {f.get('status')}"
                )

        risk = report_context.get("risk", {})
        if risk:
            parts.append(
                f"RISK LEVEL: {risk.get('level')} (score: {risk.get('score')})"
            )

        return "\n".join(parts)

    return ""


def call_chat_model(messages: list) -> str:
    last_error = None

    for model_id in CHAT_MODEL_CASCADE:
        print(f"[CHAT] Trying model: {model_id}")
        try:
            response = client.chat.completions.create(
                model=model_id,
                messages=messages,
                temperature=0.4,
                max_tokens=600,
            )

            if not response.choices:
                continue

            reply = (response.choices[0].message.content or "").strip()
            if reply:
                print(f"[CHAT] Success with {model_id}")
                return reply

        except Exception as exc:
            err_str = str(exc)
            print(f"[CHAT] Error with {model_id}: {err_str}")
            last_error = err_str
            if "401" in err_str or "403" in err_str:
                raise

    raise RuntimeError(last_error or "All chat models failed.")


@chat_bp.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Invalid request body."}), 400

        user_message = (data.get("message") or "").strip()
        report_context = data.get("context")
        history = data.get("history") or []

        if not user_message:
            return jsonify({"error": "Message cannot be empty."}), 400

        context_str = build_context_string(report_context)

        messages = [{"role": "system", "content": MEDDIE_SYSTEM}]

        for msg in history[-10:]:
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", ""),
            })

        messages.append({
            "role": "user",
            "content": f"PATIENT REPORT:\n\n{context_str}\n\nUSER QUESTION:\n\n{user_message}",
        })

        reply = call_chat_model(messages)
        return jsonify({"response": reply})

    except Exception as e:
        print("CHAT ERROR:", str(e))
        if "429" in str(e):
            return jsonify({"error": "Rate limit reached. Please wait a moment."}), 429
        return jsonify({"error": str(e)}), 500
