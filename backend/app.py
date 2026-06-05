import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Allow all origins (fine for a student project; lock down for production)
CORS(app)

# Register blueprints
from routes.analyze import analyze_bp
from routes.chat import chat_bp
from routes.doctors import doctors_bp

app.register_blueprint(analyze_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(doctors_bp)


@app.route("/")
def health():
    return {"status": "MedClear API running", "version": "2.0.0"}


@app.route("/health")
def health_check():
    return {"status": "ok", "version": "2.0.0"}


@app.errorhandler(404)
def not_found(error):
    return {"error": "Endpoint not found"}, 404


@app.errorhandler(500)
def internal_error(error):
    return {"error": "Internal server error"}, 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
