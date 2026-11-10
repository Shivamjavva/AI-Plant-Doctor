import tensorflow as tf

MODEL_PATH = "model/final_13_class_baseline.keras"

print("Loading model...")

model = tf.keras.models.load_model(MODEL_PATH)

print("Model loaded successfully!")
print("Input shape:", model.input_shape)
print("Output shape:", model.output_shape)