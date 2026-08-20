
from dotenv import load_dotenv
import os
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))
import base64
import uuid
from flask import Flask, request, jsonify, render_template, session
import requests
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "brainx-dev-secret-change-me")

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

TEXT_MODEL = os.environ.get("GROQ_TEXT_MODEL", "openai/gpt-oss-120b")
VISION_MODEL = os.environ.get("GROQ_VISION_MODEL", "qwen/qwen3.6-27b")


CHATS = {}

SYSTEM_PROMPT = (
    "You are BrainX, a sharp, friendly and intelligent AI assistant. "
    "Answer clearly and concisely. Use markdown formatting (headings, "
    "bullet points, code blocks) when it improves readability."
    "remeber to ask question to user to get more information about the question"
    "If the user provides an image, analyze it and provide insights or descriptions."
    "answer in a friendly and engaging manner, and provide actionable advice or suggestions when appropriate."
    "if the user asks for a code, provide the code in a code block and explain it in detail."
    "answer like a human, with empathy and understanding, and avoid generic or robotic responses."
)
@app.route("/")
def login():
    return render_template("login.html")
@app.route("/chat")
def index():
    return render_template("index.html")
@app.route("/api/chat", methods=["POST"])
def chat():
    if not GROQ_API_KEY:
        return jsonify({"error": "GROQ_API_KEY is not set on the server."}), 500
    chat_id = request.form.get("chat_id") or str(uuid.uuid4())
    if chat_id not in CHATS:
        CHATS[chat_id] = [{"role": "system", "content": SYSTEM_PROMPT}]
    message = (request.form.get("message") or "").strip()
    image_file = request.files.get("image")
    if not message and not image_file:
        return jsonify({"error": "Send a message or an image."}), 400
    if image_file:
        img_bytes = image_file.read()
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        mime = image_file.mimetype or "image/png"
        user_content = [
            {"type": "text", "text": message or "Describe this image."},
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
        ]
        model = VISION_MODEL
    else:
        user_content = message
        model = TEXT_MODEL
    CHATS[chat_id].append({"role": "user", "content": user_content})
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": CHATS[chat_id],
        "temperature": 0.7,
        "max_tokens": 1024,
    }
    try:
        resp = requests.post(GROQ_URL, headers=headers, json=payload, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        reply = data["choices"][0]["message"]["content"]
    except requests.exceptions.HTTPError as e:
        detail = ""
        try:
            detail = resp.json().get("error", {}).get("message", "")
        except Exception:
            detail = str(e)
        return jsonify({"error": f"Groq API error: {detail}"}), 502
    except Exception as e:
        return jsonify({"error": f"Request failed: {e}"}), 500
    CHATS[chat_id][-1] = {"role": "user", "content": message or "[image]"}
    CHATS[chat_id].append({"role": "assistant", "content": reply})
    return jsonify({"reply": reply, "chat_id": chat_id})
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)