#  MedClear AI

MedClear AI is an intelligent medical report explainer that helps users understand complex healthcare documents in plain language.

Instead of struggling with medical jargon, users can upload a PDF report or paste report text and instantly receive:

- Simple explanations of medical findings
- Identification of abnormal values
- Easy-to-understand summaries
- Suggested questions to discuss with healthcare professionals


## Features

###  Medical Report Analysis
- Upload PDF medical reports
- Paste laboratory reports, prescriptions, or discharge summaries
- Automatic text extraction from PDFs

###  AI-Powered Interpretation
- Uses Google's Gemini AI
- Converts medical terminology into plain English
- Generates patient-friendly explanations

###  Structured Insights
- Report summary
- Findings breakdown
- Status indicators:
  - Normal
  - High
  - Low
  - Informational

###  Doctor Discussion Questions
- Generates relevant follow-up questions
- Helps patients prepare for appointments

###  Modern UI
- Futuristic medical-themed design
- Animated DNA visualization
- Responsive layout
- Drag-and-drop file upload

---

## 🛠 Tech Stack

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript

### Backend
- Python
- Flask
- Flask-CORS

### AI
- Google Gemini API

### PDF Processing
- pdfplumber

---

##  Project Structure

MedClear-AI/

├── frontend/

│ ├── index.html

│ ├── style.css

│ └── script.js

│

├── backend/

│ ├── app.py

│ ├── requirements.txt

│ └── routes/

│

└── README.md

---

##  Installation

### Clone Repository

bash git clone https://github.com/prerna-patil01/MedClear-Ai.git cd MedClear-Ai 

### Backend Setup

bash cd backend  python -m venv venv  source venv/bin/activate 

Install dependencies:

bash pip install -r requirements.txt 

Create a .env file:

env GEMINI_API_KEY=your_api_key_here 

Run backend:

bash python app.py 

Backend runs on:

text http://localhost:5000 

---

##  Usage

1. Start the Flask backend
2. Open frontend/index.html
3. Upload a PDF report or paste report text
4. Click "Analyze My Report"
5. View AI-generated insights

---

##  Disclaimer

MedClear AI is intended for educational and informational purposes only.

The application does not provide medical diagnosis, treatment recommendations, or professional healthcare advice. Always seek guidance from qualified healthcare professionals for medical decisions.

---

##  Author

Prerna Patil

Computer Science Undergraduate | AI & Software Development Enthusiast

Built with curiosity, caffeine, and Gemini.
