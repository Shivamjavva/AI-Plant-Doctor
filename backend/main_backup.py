from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import tensorflow as tf
import numpy as np
import io


# --------------------------------------------------
# App
# --------------------------------------------------

app = FastAPI(title="AI Plant Doctor API")

# --------------------------------------------------
# CORS - allows React frontend to connect
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------
# Model
# --------------------------------------------------

MODEL_PATH = "model/final_13_class_baseline.keras"

print("Loading AI Plant Doctor model...")

model = tf.keras.models.load_model(MODEL_PATH)

print("Model loaded successfully!")

# --------------------------------------------------
# Class names
# --------------------------------------------------

CLASS_NAMES = [
    "Pepper,_bell___Bacterial_spot",
    "Pepper,_bell___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Tomato_mosaic_virus",
    "Tomato___healthy"
]

# --------------------------------------------------
# Health check
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "AI Plant Doctor API is running",
        "model": "final_13_class_baseline",
        "classes": len(CLASS_NAMES)
    }


# --------------------------------------------------
# Prediction
# --------------------------------------------------

@app.post("/predict")
async def predict(file: UploadFile = File(...)):

    # Read uploaded image
    image_data = await file.read()

    # Open image
    image = Image.open(io.BytesIO(image_data)).convert("RGB")

    # Resize to model input size
    image = image.resize((224, 224))

    # Convert to numpy
    image_array = np.array(image)

    # Add batch dimension
    image_array = np.expand_dims(image_array, axis=0)

    # Prediction
    predictions = model.predict(image_array, verbose=0)

    # Find highest probability
    predicted_index = int(np.argmax(predictions[0]))

    confidence = float(predictions[0][predicted_index]) * 100

    predicted_class