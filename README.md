# 🌱 AI Plant Doctor – AI-Based Plant Disease Detection

### An Intelligent Plant Health Monitoring System Using Deep Learning

## 📌 Project Overview
AI Plant Doctor is an AI/ML-based web application designed to identify plant diseases through leaf image analysis. It uses a deep learning model to classify plant leaf conditions and provides disease information, treatment recommendations, and prevention methods.

Users can upload a plant leaf image and receive an instant prediction through an interactive web interface.

## 🎯 Objectives
- Detect plant diseases using artificial intelligence.
- Support early identification of plant health problems.
- Provide treatment and prevention recommendations.
- Make plant disease diagnosis accessible through a web application.

## 🌿 Supported Plants
- Tomato
- Potato
- Bell Pepper

## ✨ Key Features
- AI-based plant disease classification.
- 13 plant disease and healthy leaf categories.
- Prediction confidence score.
- Grad-CAM visualization for model explainability.
- Disease descriptions and treatment recommendations.
- AI-powered Plant Assistant chatbot.
- Image validation and error handling.

## 🛠️ Technologies Used

| Component | Technology |
|---|---|
| Frontend | React.js, Vite, CSS |
| Backend | Python, FastAPI |
| Deep Learning | TensorFlow, MobileNetV2 |
| Visualization | Grad-CAM |
| AI Chatbot | Google Gemini API |
| Deployment | AWS (planned/in progress) |

## 📊 Dataset Information
- Total images: 15,695
- Training images: 12,556
- Validation images: 3,139
- Number of classes: 13

## 🧠 Model
The project uses a MobileNetV2-based deep learning architecture for plant leaf disease classification.

## 🚀 Main Application Workflow
1. User uploads a plant leaf image.
2. Backend validates the uploaded image.
3. The trained deep learning model predicts the plant condition.
4. The application displays the predicted disease and confidence.
5. Grad-CAM highlights important image regions.
6. Treatment and prevention information is provided.

## 📁 Project Structure
```text
AI-Plant-Doctor/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── model/
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
├── README.md
└── .gitignore
```

## 🎓 Project Purpose
Developed as an academic AI/ML project to demonstrate the practical application of deep learning, computer vision, and web development in agriculture.

## 👨‍💻 Project Status
Development and testing in progress. Cloud deployment is planned.

---

**AI Plant Doctor – Smart Technology for Healthier Plants 🌱**
