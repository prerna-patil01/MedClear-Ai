# MedClear AI

MedClear AI is an advanced AI-powered medical report intelligence platform that transforms complex healthcare reports into clear, actionable insights.

Users can upload medical reports, laboratory results, prescriptions, discharge summaries, or report images and instantly receive an interactive analysis dashboard powered by modern AI.

Application can be accessed here : https://med-clear-ai.vercel.app/
---

## Features

### AI Medical Report Analysis
- Upload PDF reports
- Upload medical report images
- Paste report text directly
- Automatic document extraction and processing
- Intelligent medical data interpretation

### AI-Powered Insights
- Plain-language explanations of medical findings
- Comprehensive AI-generated report summaries
- Abnormal value detection
- Risk assessment and severity analysis
- Organ-specific impact visualization

### Interactive Anatomy Visualization
- Interactive human anatomy panel
- Organ highlighting based on report findings
- Visual representation of affected body systems
- Severity-based organ indicators

### Meddie AI Assistant
- Built-in AI healthcare assistant
- Ask questions about your report
- Explain abnormal values
- Understand medical terminology
- Receive contextual follow-up guidance

### Personalized Recommendations
- Lifestyle recommendations
- Dietary suggestions
- Preventive healthcare guidance
- Wellness improvement suggestions

### Doctor Preparation Tools
- Automatically generated questions for healthcare professionals
- Appointment preparation assistance
- Discussion point recommendations

### Doctor Discovery
- Find relevant specialists nearby
- Specialty-based recommendations
- Location-aware doctor search

### PDF Export
- Download professional report summaries
- Export AI-generated insights
- Share findings easily

### Modern Dashboard Experience
- Premium healthcare-inspired UI
- Glassmorphism design system
- Interactive analytics cards
- Dark mode interface
- Responsive design for desktop, tablet, and mobile
- Smooth animations and micro-interactions

---

## Tech Stack

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript

### Backend
- Python
- Flask
- Flask-CORS

### AI Services
- Groq API
- OpenRouter API
- Large Language Models for medical explanation and reasoning

### Medical Report Processing
- PDF extraction
- Image processing
- OCR support
- Structured medical data parsing

### Deployment
- Frontend: Vercel
- Backend: Render

---

## Project Structure

text MedClear-AI/ │ ├── frontend/ │   ├── index.html │   ├── style.css │   └── script.js │ ├── backend/ │   ├── app.py │   ├── extensions.py │   ├── requirements.txt │   │ │   └── routes/ │       ├── __init__.py │       ├── analyze.py │       ├── chat.py │       └── doctors.py │ ├── .gitignore └── README.md 

---

## Installation

### Clone Repository

bash git clone https://github.com/prerna-patil01/MedClear-Ai.git cd MedClear-Ai 

### Backend Setup

bash cd backend  python -m venv venv 

#### Windows

bash venv\Scripts\activate 

#### Linux / macOS

bash source venv/bin/activate 

### Install Dependencies

bash pip install -r requirements.txt 

### Create Environment Variables

Create a .env file inside the backend directory:

env GROQ_API_KEY=your_groq_api_key OPENROUTER_API_KEY=your_openrouter_api_key 

### Run Backend

bash python app.py 

Backend runs at:

text http://localhost:5000 

---

## Usage

1. Start the backend server.
2. Open the frontend application.
3. Upload a medical report, image, or paste report text.
4. Click Analyze Report.
5. Review:
   - AI Summary
   - Key Findings
   - Abnormal Values
   - Risk Assessment
   - Interactive Anatomy View
   - Lifestyle Recommendations
   - Questions for Your Doctor
6. Chat with Meddie AI for additional explanations.
7. Export insights as PDF if required.

---

## Disclaimer

MedClear AI is intended for educational and informational purposes only.

The application does not provide medical diagnoses, treatment plans, emergency medical advice, or professional healthcare recommendations.

Always consult qualified healthcare professionals regarding medical conditions, treatment decisions, prescriptions, or healthcare concerns.

---

## Author

Prerna Patil

Computer Science Undergraduate • Software Development • Artificial Intelligence

**Built with curiosity, caffeine, and countless late-night debugging sessions.**
