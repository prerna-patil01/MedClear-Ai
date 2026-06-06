import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from extensions import limiter

load_dotenv()

app = Flask(__name__)

# 10 MB max upload size
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

CORS(app, origins="*")
limiter.init_app(app)

from routes.analyze import analyze_bp
from routes.chat    import chat_bp
from routes.doctors import doctors_bp
from routes.diet    import diet_bp      

app.register_blueprint(analyze_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(doctors_bp)
app.register_blueprint(diet_bp)       


@app.route("/")
def root():
    return {"status": "MedClear API running", "version": "3.0.0"}


@app.route("/health")
def health():
    return {"status": "ok"}


@app.errorhandler(404)
def not_found(e):
    return {"error": "Endpoint not found"}, 404


@app.errorhandler(413)
def too_large(e):
    return {"error": "File too large. Maximum size is 10 MB."}, 413


@app.errorhandler(429)
def rate_limited(e):
    return {"error": "Too many requests. Please wait a moment."}, 429


@app.errorhandler(500)
def server_error(e):
    return {"error": "Internal server error"}, 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
