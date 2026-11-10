import os
import asyncio

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import Literal
from fastapi import HTTPException




# 
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from PIL import Image, UnidentifiedImageError
import tensorflow as tf
import numpy as np
import io


# --------------------------------------------------
# App
# --------------------------------------------------

app = FastAPI(title="AI Plant Doctor API")

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}
# --------------------------------------------------
# CORS - allows React frontend to connect
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
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
# Grad-CAM feature extractor
# --------------------------------------------------

backbone = model.get_layer("mobilenetv2_1.00_224")

gradcam_extractor = tf.keras.Model(
    inputs=backbone.input,
    outputs=backbone.get_layer("out_relu").output
)


def create_gradcam_heatmap(image_batch):
    """Generate a Grad-CAM heatmap for the predicted class."""

    image_tensor = tf.convert_to_tensor(
        image_batch, dtype=tf.float32
    )

    with tf.GradientTape() as tape:
        feature_maps = gradcam_extractor(
            image_tensor, training=False
        )

        # Watch feature maps for gradient calculation
        tape.watch(feature_maps)

        # Pass feature maps through the existing classifier
        x = model.get_layer(
            "global_average_pooling2d"
        )(feature_maps)

        x = model.get_layer("dropout")(
            x, training=False
        )

        predictions = model.get_layer("dense")(x)

        predicted_index = tf.argmax(predictions[0])
        class_score = predictions[:, predicted_index]

    gradients = tape.gradient(class_score, feature_maps)

    if gradients is None:
        raise ValueError(
            "Grad-CAM gradients could not be calculated."
        )

    # Calculate the importance of each feature channel
    weights = tf.reduce_mean(
        gradients, axis=(0, 1, 2)
    )

    feature_maps = feature_maps[0]

    # Combine feature maps using their importance weights
    heatmap = tf.reduce_sum(
        feature_maps * weights, axis=-1
    )

    # Normalize heatmap between 0 and 1
    heatmap = tf.maximum(heatmap, 0)

    heatmap = heatmap / (
        tf.reduce_max(heatmap)
        + tf.keras.backend.epsilon()
    )

    return heatmap.numpy()


# --------------------------------------------------
# Class names
# IMPORTANT: Keep these in the model's output order.
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
    "Tomato___healthy",
]


# --------------------------------------------------
# Disease information and recommendations
# --------------------------------------------------

DISEASE_INFO = {
    "Pepper,_bell___Bacterial_spot": {
        "disease": "Bacterial Spot",
        "status": "disease",
        "description": (
            "A bacterial disease that can cause dark, "
            "water-soaked spots on pepper leaves and fruit."
        ),
        "treatment": [
            "Remove badly infected leaves when practical.",
            "Avoid handling plants while their leaves are wet.",
            "Clean tools and avoid overhead watering.",
            "Consult a local agricultural expert about "
            "suitable registered treatments.",
        ],
        "prevention": [
            "Use disease-free seeds and healthy seedlings.",
            "Rotate crops and remove infected plant debris.",
            "Avoid splashing soil or water onto leaves.",
        ],
    },

    "Pepper,_bell___healthy": {
        "disease": "Healthy",
        "status": "healthy",
        "description": (
            "The model predicts no visible disease from "
            "the classes it was trained to recognize."
        ),
        "treatment": [
            "No disease-specific treatment is indicated "
            "by this prediction."
        ],
        "prevention": [
            "Water appropriately.",
            "Inspect leaves regularly.",
            "Maintain good airflow around plants.",
        ],
    },

    "Potato___Early_blight": {
        "disease": "Early Blight",
        "status": "disease",
        "description": (
            "A fungal disease often associated with brown "
            "leaf spots that develop concentric rings."
        ),
        "treatment": [
            "Remove severely affected foliage when practical.",
            "Avoid wetting leaves during irrigation.",
            "Consult an agricultural expert about suitable "
            "registered fungicides if needed.",
        ],
        "prevention": [
            "Rotate crops and remove infected plant debris.",
            "Maintain suitable spacing and airflow.",
            "Keep plants healthy with balanced nutrition.",
        ],
    },

    "Potato___Late_blight": {
        "disease": "Late Blight",
        "status": "disease",
        "description": (
            "A potentially destructive disease that can "
            "spread rapidly in cool, wet conditions."
        ),
        "treatment": [
            "Separate suspected infected plants where practical.",
            "Avoid moving wet foliage between plants.",
            "Seek prompt local agricultural advice about "
            "disease management and registered treatments.",
        ],
        "prevention": [
            "Use healthy seed potatoes.",
            "Avoid prolonged leaf wetness.",
            "Inspect plants frequently during cool, humid weather.",
        ],
    },

    "Potato___healthy": {
        "disease": "Healthy",
        "status": "healthy",
        "description": (
            "The model predicts no visible disease from "
            "the classes it was trained to recognize."
        ),
        "treatment": [
            "No disease-specific treatment is indicated "
            "by this prediction."
        ],
        "prevention": [
            "Use healthy seed potatoes.",
            "Rotate crops.",
            "Monitor foliage regularly.",
        ],
    },

    "Tomato___Bacterial_spot": {
        "disease": "Bacterial Spot",
        "status": "disease",
        "description": (
            "A bacterial disease that can cause dark spots "
            "on tomato leaves, stems, and fruit."
        ),
        "treatment": [
            "Remove severely affected plant material when practical.",
            "Avoid handling plants while wet.",
            "Ask an agricultural expert about registered "
            "management options.",
        ],
        "prevention": [
            "Use healthy seeds and seedlings.",
            "Clean tools and rotate crops.",
            "Avoid overhead watering and water splashes.",
        ],
    },

    "Tomato___Early_blight": {
        "disease": "Early Blight",
        "status": "disease",
        "description": (
            "Often causes brown leaf lesions with concentric "
            "rings, especially on older leaves."
        ),
        "treatment": [
            "Remove badly affected lower leaves when practical.",
            "Water near the soil instead of over foliage.",
            "Seek advice about suitable registered fungicides "
            "if the disease progresses.",
        ],
        "prevention": [
            "Rotate crops and remove infected plant debris.",
            "Provide adequate spacing and airflow.",
            "Use mulch to reduce soil splash.",
        ],
    },

    "Tomato___Late_blight": {
        "disease": "Late Blight",
        "status": "disease",
        "description": (
            "A serious disease that may cause rapidly "
            "spreading dark lesions in cool, damp conditions."
        ),
        "treatment": [
            "Separate suspected affected plants where practical.",
            "Avoid moving wet plant material around the garden.",
            "Seek prompt agricultural advice about management."
        ],
        "prevention": [
            "Inspect plants frequently during wet weather.",
            "Avoid prolonged leaf wetness.",
            "Remove infected debris safely and follow local guidance.",
        ],
    },

    "Tomato___Leaf_Mold": {
        "disease": "Leaf Mold",
        "status": "disease",
        "description": (
            "A fungal disease associated with high humidity. "
            "It can cause yellow patches on upper leaf surfaces."
        ),
        "treatment": [
            "Remove severely affected leaves when practical.",
            "Improve ventilation around plants.",
            "Consider registered treatments with local "
            "agricultural guidance if needed.",
        ],
        "prevention": [
            "Reduce humidity in covered growing areas.",
            "Avoid overhead watering.",
            "Space plants adequately for airflow.",
        ],
    },

    "Tomato___Septoria_leaf_spot": {
        "disease": "Septoria Leaf Spot",
        "status": "disease",
        "description": (
            "Often produces many small circular leaf spots "
            "with pale centers and darker edges."
        ),
        "treatment": [
            "Remove affected lower leaves when practical.",
            "Avoid splashing soil onto leaves.",
            "Seek local advice about registered fungicides "
            "if the disease progresses.",
        ],
        "prevention": [
            "Rotate crops and remove infected debris.",
            "Use mulch to reduce soil splash.",
            "Water at soil level and improve airflow.",
        ],
    },

    "Tomato___Spider_mites Two-spotted_spider_mite": {
        "disease": "Spider Mites",
        "status": "disease",
        "description": (
            "Tiny pests that may cause fine leaf speckling, "
            "yellowing, and sometimes delicate webbing."
        ),
        "treatment": [
            "Inspect the undersides of leaves carefully.",
            "Remove heavily infested leaves when practical.",
            "Use an appropriately labelled pest-control method "
            "and protect beneficial insects.",
        ],
        "prevention": [
            "Inspect plants regularly for early signs.",
            "Avoid excessive drought stress.",
            "Clean up heavily infested plant debris.",
        ],
    },

    "Tomato___Tomato_mosaic_virus": {
        "disease": "Tomato Mosaic Virus",
        "status": "disease",
        "description": (
            "A viral disease that may cause mottled leaf "
            "colouring, distorted growth, and reduced vigour."
        ),
        "treatment": [
            "There is no curative treatment for an infected plant.",
            "Follow local agricultural guidance on removing "
            "suspected infected plants.",
            "Clean hands and tools after handling suspected "
            "infected plants.",
        ],
        "prevention": [
            "Use healthy seeds and seedlings.",
            "Disinfect tools and wash hands between plants.",
            "Avoid tobacco contamination when handling plants.",
        ],
    },

    "Tomato___healthy": {
        "disease": "Healthy",
        "status": "healthy",
        "description": (
            "The model predicts no visible disease from "
            "the classes it was trained to recognize."
        ),
        "treatment": [
            "No disease-specific treatment is indicated "
            "by this prediction."
        ],
        "prevention": [
            "Water appropriately at soil level.",
            "Maintain good airflow.",
            "Inspect leaves regularly for changes.",
        ],
    },
}


# --------------------------------------------------
# Health check
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "AI Plant Doctor API is running",
        "model": "final_13_class_baseline",
        "classes": len(CLASS_NAMES),
        "features": [
            "Disease prediction",
            "Disease recommendations",
            "Grad-CAM heatmap",
        ],
    }


# --------------------------------------------------
# Prediction endpoint
# --------------------------------------------------


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        # Check file type
        if file.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=400,
                detail="Upload a JPG, PNG, or WEBP image."
            )

        # Read image
        image_data = await file.read()

        if not image_data:
            raise HTTPException(
                status_code=400,
                detail="The uploaded image is empty."
            )

        # Check image size
        if len(image_data) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="Image must be no larger than 10 MB."
            )

        # Decode image
        image = Image.open(
            io.BytesIO(image_data)
        ).convert("RGB")

        # Reject unsupported image subjects
        await validate_supported_plant_leaf(
            image_data,
            file.content_type
        )

        # Prepare image for TensorFlow
        image = image.resize((224, 224))
        image_array = np.array(image, dtype=np.float32)
        image_array = np.expand_dims(image_array, axis=0)

        # Predict disease
        predictions = model.predict(image_array, verbose=0)
        predicted_index = int(np.argmax(predictions[0]))

        if predicted_index >= len(CLASS_NAMES):
            raise HTTPException(
                status_code=500,
                detail="Model output does not match the class list."
            )

        confidence = float(predictions[0][predicted_index]) * 100
        predicted_class = CLASS_NAMES[predicted_index]

        disease_info = DISEASE_INFO.get(
            predicted_class,
            {
                "disease": predicted_class,
                "status": "unknown",
                "description": "No recommendation is available.",
                "treatment": [],
                "prevention": [],
            }
        )

        return {
            "prediction": predicted_class,
            "confidence": round(confidence, 2),
            "disease_info": disease_info
        }

    except HTTPException:
        raise

    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Invalid image. Please upload a readable image."
        )

    except Exception as exc:
        print(f"Prediction error: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Prediction failed. Please try another image."
        )



# --------------------------------------------------
# Grad-CAM endpoint
# --------------------------------------------------

@app.post("/gradcam")
async def gradcam(file: UploadFile = File(...)):
    try:
        
        if file.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=400,
                detail="Upload a JPG, PNG, or WEBP image."
            )

        image_data = await file.read()

        if not image_data:
            raise HTTPException(
                status_code=400,
                detail="The uploaded image is empty."
            )

        if len(image_data) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="Image must be no larger than 10 MB."
            )

        pil_image = Image.open(
            io.BytesIO(image_data)
        ).convert("RGB")

        await validate_supported_plant_leaf(
            image_data,
            file.content_type
        )

        pil_image = pil_image.resize((224, 224))


        # Generate Grad-CAM heatmap
        heatmap = create_gradcam_heatmap(image_batch)

        # Resize heatmap to image dimensions
        heatmap = np.clip(heatmap, 0, 1)

        heatmap_image = Image.fromarray(
            np.uint8(heatmap * 255)
        ).resize(
            (224, 224), Image.Resampling.BILINEAR
        )

        h = np.asarray(
            heatmap_image, dtype=np.float32
        ) / 255.0

        # Create a colored heatmap
        colors = np.stack(
            [
                np.clip(3 * h, 0, 1),
                np.clip(3 * h - 1, 0, 1),
                np.clip(3 * h - 2, 0, 1),
            ],
            axis=-1,
        )

        colors = (colors * 255).astype(np.uint8)

        # Blend heatmap with original leaf image
        overlay = (
            0.60 * original.astype(np.float32)
            + 0.40 * colors.astype(np.float32)
        )

        overlay = np.clip(
            overlay, 0, 255
        ).astype(np.uint8)

        # Return the overlay as a PNG image
        output = io.BytesIO()

        Image.fromarray(overlay).save(
            output, format="PNG"
        )

        output.seek(0)

        return StreamingResponse(
            output,
            media_type="image/png",
        )

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Grad-CAM failed: {exc}",
        )
#

# ---------------- AI PLANT ASSISTANT ----------------

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

gemini_client = (
    genai.Client(api_key=GEMINI_API_KEY)
    if GEMINI_API_KEY
    else None
)
async def validate_supported_plant_leaf(image_data, mime_type):
    """Reject images that do not appear to show a supported plant leaf."""

    if gemini_client is None:
        raise HTTPException(
            status_code=503,
            detail="Image validation is unavailable. Check your Gemini API key."
        )

    prompt = """
    You are an image eligibility checker for an AI Plant Doctor.

    Inspect the attached image and decide whether its main subject
    is a real plant leaf suitable for disease analysis.

    This application analyzes leaves from tomato, potato, and pepper
    plants. Accept a clear leaf image that could reasonably be one
    of these plants, even if the species is uncertain.

    Reject images whose main subject is an animal, person, building,
    vehicle, unrelated object, food, screenshot, or a non-leaf subject.
    Reject images where no suitable plant leaf is visible.

    Reply with exactly one label:
    LEAF
    NOT_LEAF

    Do not provide an explanation.
    """

    try:
        response = await asyncio.to_thread(
            gemini_client.models.generate_content,
            model=GEMINI_MODEL,
            contents=[
                types.Part.from_bytes(
                    data=image_data,
                    mime_type=mime_type,
                ),
                prompt,
            ],
            config=types.GenerateContentConfig(
                temperature=0,
                max_output_tokens=10,
            ),
        )

        verdict = "".join(
            character
            for character in (response.text or "").upper()
            if character.isalpha()
        )

        if verdict != "LEAF":
            raise HTTPException(
                status_code=400,
                detail=(
                    "Unsupported image. Please upload a clear leaf "
                    "from a tomato, potato, or pepper plant."
                ),
            )

    except HTTPException:
        raise

    except Exception as exc:
        print(
            f"Plant image validation error: "
            f"{type(exc).__name__}: {exc}"
        )
        raise HTTPException(
            status_code=503,
            detail=(
                "Could not validate this image right now. "
                "Please try again shortly."
            ),
        )


PLANT_SYSTEM_PROMPT = """
You are AI Plant Doctor, a helpful agricultural assistant specializing
in tomato, potato, and pepper plants.

Give practical, accurate advice in simple English.
Keep answers concise, ideally 3-6 bullet points.
Help with plant diseases, symptoms, prevention, watering, soil,
nutrition, and general plant care.
Explain possible causes without claiming certainty from text alone.
Never claim to have analyzed an image unless one was provided.
Do not invent pesticide doses or unsafe treatment instructions.
Recommend consulting a local agricultural expert for severe problems.
For unrelated questions, politely redirect to plant care.
"""



class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1500)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=12)


@app.post("/chat")
async def chat_with_plant_assistant(request: ChatRequest):
    if gemini_client is None:
        raise HTTPException(
            status_code=503,
            detail="Gemini API key is not configured. Check backend/.env."
        )

    # Keep only the recent conversation, and ensure the last message
    # is the user's question.
    messages = request.messages[-12:]

    if messages[-1].role != "user":
        raise HTTPException(
            status_code=400,
            detail="The last message must be a user message."
        )

    conversation = [
        types.Content(
            role="user" if message.role == "user" else "model",
            parts=[types.Part.from_text(text=message.content.strip())],
        )
        for message in messages
    ]

    try:
        response = await asyncio.to_thread(
            gemini_client.models.generate_content,
            model=GEMINI_MODEL,
            contents=conversation,
            config=types.GenerateContentConfig(
                system_instruction=PLANT_SYSTEM_PROMPT,
                temperature=0.4,
                max_output_tokens=250,
            ),
        )

        answer = response.text

        if not answer:
            raise HTTPException(
                status_code=502,
                detail="The AI returned an empty response. Please try again."
            )

        return {"reply": answer}

    except HTTPException:
        raise

    except Exception as exc:
        print(f"Gemini chat error: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=502,
            detail=(
                "The AI assistant could not respond right now. "
                "Check your Gemini API key, model access, quota, "
                "and internet connection."
            ),
        )
#

# --------------------------------------------------
# DETAILED DISEASE ANALYSIS REPORT
# --------------------------------------------------

class DiseaseAnalysisRequest(BaseModel):
    prediction: str = Field(min_length=1, max_length=150)
    confidence: float = Field(ge=0, le=100)


@app.post("/analyze-disease")
async def analyze_disease(request: DiseaseAnalysisRequest):

    if gemini_client is None:
        raise HTTPException(
            status_code=503,
            detail="Gemini API key is not configured. Check backend/.env."
        )

    # Only accept classes recognized by our trained model
    if request.prediction not in CLASS_NAMES:
        raise HTTPException(
            status_code=400,
            detail="Unknown disease class."
        )

    # Reuse the existing disease information
    info = DISEASE_INFO.get(request.prediction)

    if info is None:
        raise HTTPException(
            status_code=404,
            detail="Disease information not found."
        )

    plant = request.prediction.split("___")[0].replace("_", " ")
    plant = plant.replace(",", "").strip().title()

    known_information = {
        "plant": plant,
        "predicted_disease": info["disease"],
        "status": info["status"],
        "description": info["description"],
        "existing_treatment_guidance": info["treatment"],
        "existing_prevention_guidance": info["prevention"],
    }

    prompt = f"""
You are the report generator for an AI Plant Doctor college project.

Create a detailed, easy-to-understand plant disease analysis report
using ONLY the information and prediction supplied below.

MODEL PREDICTION:
Plant: {plant}
Predicted class: {request.prediction}
Model confidence score: {request.confidence:.2f}%

EXISTING DISEASE INFORMATION:
{known_information}

Use these headings:

1. Prediction Summary
2. Common Symptoms
3. Possible Causes and Contributing Conditions
4. Recommended Next Steps
5. Prevention and Plant Care
6. Important Precautions

Rules:
- Explain the predicted class in simple English.
- Use the supplied description and recommendations as the main guidance.
- Do not claim that you independently inspected the image.
- Do not invent symptoms as confirmed observations.
- Do not treat model confidence as a guarantee of correctness.
- Explain that other diseases or conditions may look similar.
- If status is healthy, provide routine care advice instead.
- Never invent pesticide doses or guarantee a cure.
- Recommend a local agricultural expert for severe or uncertain cases.
- Keep the report useful and under 450 words.
"""

    try:
        response = await asyncio.to_thread(
            gemini_client.models.generate_content,
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=600,
            ),
        )

        report = response.text

        if not report:
            raise HTTPException(
                status_code=502,
                detail="The AI returned an empty report. Please try again."
            )

        return {
            "prediction": request.prediction,
            "disease": info["disease"],
            "plant": plant,
            "confidence": round(request.confidence, 2),
            "disease_info": info,
            "report": report,
        }

    except HTTPException:
        raise

    except Exception as exc:
        print(
            f"Disease report error: {type(exc).__name__}: {exc}"
        )
        raise HTTPException(
            status_code=502,
            detail="Could not generate the disease report. Please try again."
        )