import os
import json
import google.generativeai as genai
from flask import Blueprint, request, jsonify

chat_bp = Blueprint("chat", __name__)

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")

MEDDIE_SYSTEM = """
You are Meddie, a warm and knowledgeable AI health companion for MedClear.
You have been given the user's analyzed medical report as context.
Your role is to help the user understand their report in plain, compassionate language.

Guidelines:
- Always refer to the actual values from the provided report context when answering
- Be warm, supportive, and clear — like a knowledgeable friend
- Never diagnose, prescribe, or recommend specific medications
- Always encourage the user to discuss findings with their doctor
- Keep answers concise (3-5 sentences max unless a detailed explanation is needed)
- If asked something outside the report, you can answer general health questions briefly
- If the user seems worried, be reassuring but honest
- End serious answers with "Your doctor can give you the most accurate guidance on this."
- Do NOT repeat the full report back — focus on the specific question asked
"""

@chat_bp.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid request body."}), 400

    user_message = (data.get("message") or "").strip()
    report_context = data.get("reportContext") or {}
    history = data.get("history") or []  # [{role, content}]

    if not user_message:
        return jsonify({"error": "Message cannot be empty."}), 400

    if len(user_message) > 2000:
        return jsonify({"error": "Message is too long. Please keep it under 2000 characters."}), 400

    # Build the context string from the analyzed report
    context_parts = []
    if report_context:
        context_parts.append(f"REPORT TITLE: {report_context.get('title', 'Medical Report')}")
        context_parts.append(f"SUMMARY: {report_context.get('summary', '')}")
        
        findings = report_context.get("findings", [])
        if findings:
            context_parts.append("FINDINGS:")
            for f in findings:
                context_parts.append(
                    f"  - {f.get('name')}: {f.get('value')} (ref: {f.get('reference')}) — Status: {f.get('status').upper()}"
                )

        risk = report_context.get("risk", {})
        if risk:
            context_parts.append(f"RISK LEVEL: {risk.get('level', 'unknown').upper()} (score: {risk.get('score', 'N/A')})")

    context_str = "\n".join(context_parts) if context_parts else "No report has been analyzed yet."

    # Build conversation history for multi-turn
    conversation = []
    for msg in history[-10:]:  # last 10 messages max
        role = "user" if msg.get("role") == "user" else "model"
        conversation.append({"role": role, "parts": [msg.get("content", "")]})

    # Add the current user message
    full_user_message = f"""
{MEDDIE_SYSTEM}

PATIENT'S ANALYZED REPORT CONTEXT:
{context_str}

User's question: {user_message}
"""

    try:
        if conversation:
            # Multi-turn with history
            chat_session = model.start_chat(history=conversation[:-1] if conversation else [])
            response = chat_session.send_message(full_user_message)
        else:
            response = model.generate_content(full_user_message)

        reply = response.text.strip()
        return jsonify({"reply": reply})

    except Exception as e:
        error_msg = str(e)
        if "quota" in error_msg.lower() or "429" in error_msg:
            return jsonify({"error": "Rate limit reached. Please wait a moment."}), 429
        return jsonify({"error": "Meddie is temporarily unavailable. Please try again."}), 500