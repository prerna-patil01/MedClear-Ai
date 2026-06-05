import os
from openai import OpenAI
from flask import Blueprint, request, jsonify
from extensions import limiter

chat_bp = Blueprint("chat", __name__)

GROQ_KEY = os.environ.get("GROQ_API_KEY", "")
groq = OpenAI(api_key=GROQ_KEY, base_url="https://api.groq.com/openai/v1")

OR_KEY = os.environ.get("OPENROUTER_API_KEY", "")
openrouter = OpenAI(api_key=OR_KEY, base_url="https://openrouter.ai/api/v1")

# Fast models for chat — speed matters more than raw capability here
GROQ_CHAT_MODELS = [
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "gemma2-9b-it",
    "mixtral-8x7b-32768",
]

MEDDIE_SYSTEM = """You are Meddie, a warm and knowledgeable AI health companion for MedClear.

The user has received an AI-analyzed medical report. Your role is to help them understand it.

Guidelines:
- Always refer to the actual values from the report context provided.
- Be warm, supportive, and speak in plain language.
- Never diagnose or prescribe medications.
- Encourage the user to discuss findings with their doctor.
- Keep answers concise — 3 to 5 sentences.
- If the user seems worried, be reassuring but honest.
- End answers about serious findings with: "Your doctor can give you the most accurate guidance on this."
- If asked something outside the report scope, answer briefly and redirect.
"""


def build_context(report_context) -> str:
    if not report_context:
        return ""
    if isinstance(report_context, str):
        return report_context
    if not isinstance(report_context, dict):
        return ""

    parts = [f"REPORT: {report_context.get('title', 'Medical Report')}"]

    risk = report_context.get("risk", {})
    if isinstance(risk, dict):
        parts.append(
            f"RISK: {risk.get('level', '').upper()} (score {risk.get('score', 0)}/10) — {risk.get('reason', '')}"
        )
    elif isinstance(risk, str):
        parts.append(f"RISK: {risk}")

    parts.append(f"SUMMARY: {report_context.get('summary', '')}")

    findings = report_context.get("findings", [])
    if findings:
        parts.append("KEY FINDINGS:")
        for f in findings:
            parts.append(
                f"  • {f.get('name')}: {f.get('value')} "
                f"(ref: {f.get('reference', 'N/A')}) — {f.get('status', '').upper()}"
            )

    specialists = report_context.get("specialists", [])
    if specialists:
        parts.append(f"RECOMMENDED SPECIALISTS: {', '.join(specialists)}")

    return "\n".join(parts)


def call_chat_model(messages: list) -> str:
    last_err = None

    # --- Groq ---
    for model in GROQ_CHAT_MODELS:
        print(f"[CHAT] Groq: {model}")
        try:
            resp = groq.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.4,
                max_tokens=600,
            )
            reply = (resp.choices[0].message.content or "").strip()
            if reply:
                return reply
        except Exception as e:
            err = str(e)
            print(f"[CHAT] Error {model}: {err}")
            last_err = err
            if "401" in err or "403" in err:
                break

    # --- OpenRouter fallback ---
    if OR_KEY:
        try:
            import requests as http_requests
            resp_list = http_requests.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {OR_KEY}"},
                timeout=6,
            ).json().get("data", [])
            free_ids = [
                m["id"] for m in resp_list
                if str(m.get("pricing", {}).get("prompt", "1")).strip() in ("0", "0.0")
            ][:3]
        except Exception:
            free_ids = []

        for model in free_ids:
            print(f"[CHAT] OpenRouter fallback: {model}")
            try:
                resp = openrouter.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=0.4,
                    max_tokens=600,
                    extra_headers={
                        "HTTP-Referer": "https://med-clear-ai.vercel.app",
                        "X-Title": "MedClear AI",
                    },
                )
                reply = (resp.choices[0].message.content or "").strip()
                if reply:
                    return reply
            except Exception as e:
                print(f"[CHAT] OpenRouter error {model}: {e}")
                last_err = str(e)

    raise RuntimeError(last_err or "All chat models failed.")


@chat_bp.route("/api/chat", methods=["POST"])
@limiter.limit("20 per minute")
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

        context_str = build_context(report_context)

        messages = [{"role": "system", "content": MEDDIE_SYSTEM}]

        if context_str:
            messages.append({
                "role": "system",
                "content": f"PATIENT REPORT CONTEXT:\n\n{context_str}",
            })

        for msg in history[-10:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": user_message})

        reply = call_chat_model(messages)
        return jsonify({"response": reply})

    except Exception as e:
        print(f"[CHAT] Fatal: {e}")
        if "429" in str(e):
            return jsonify({"error": "Rate limit reached. Please wait a moment."}), 429
        return jsonify({"error": str(e)}), 500
