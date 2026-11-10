import { useEffect, useState } from "react";
import PlantAssistant from "./PlantAssistant";
import WelcomeIntro from "./WelcomeIntro";
import RecoveryTracker from "./RecoveryTracker";
import DiseaseReportButton from "./DiseaseReportButton";

import {
  Leaf,
  Upload,
  ScanSearch,
  ShieldCheck,
  Activity,
  Bot,
  ChevronRight,
  Sparkles,
  Microscope,
  CircleCheck,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  LoaderCircle,
} from "lucide-react";
import "./App.css";

const API_BASE = "http://127.0.0.1:8000";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

function App() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingHeatmap, setLoadingHeatmap] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [heatmap, setHeatmap] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Release browser-created image URLs when they are replaced or the component unmounts.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    return () => {
      if (heatmap) URL.revokeObjectURL(heatmap);
    };
  }, [heatmap]);

  const clearHeatmap = () => {
    setHeatmap((oldUrl) => {
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      return null;
    });
    setShowHeatmap(false);
  };

  const handleImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError("Please choose an image smaller than 10 MB.");
      event.target.value = "";
      return;
    }

    setImage(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError("");
    clearHeatmap();
  };

  const formatPrediction = (prediction, confidence) => {
    let plant = "Unknown";
    let disease = prediction;
    let status = "Potential Disease Detected";

    if (prediction.startsWith("Tomato___")) {
      plant = "Tomato";
      disease = prediction.replace("Tomato___", "");
    } else if (prediction.startsWith("Potato___")) {
      plant = "Potato";
      disease = prediction.replace("Potato___", "");
    } else if (prediction.startsWith("Pepper,_bell___")) {
      plant = "Pepper";
      disease = prediction.replace("Pepper,_bell___", "");
    }

    disease = disease.replaceAll("_", " ").replaceAll(",", "").trim();
    if (disease.toLowerCase() === "healthy") status = "Healthy Prediction";

    return { plant, disease, confidence, status };
  };

  const analyzePlant = async () => {
    if (!image) {
      setError("Please upload a plant leaf image first.");
      return;
    }

    setAnalyzing(true);
    setResult(null);
    setError("");
    clearHeatmap();

    try {
      const formData = new FormData();
      formData.append("file", image);

      const response = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const details = await response.text();
        throw new Error(`Prediction failed: ${details}`);
      }

      const data = await response.json();
      if (!data.prediction || data.confidence === undefined) {
        throw new Error("The backend returned an invalid prediction.");
      }

      const formattedResult = formatPrediction(
        data.prediction,
        Number(data.confidence)
      );
      const diseaseInfo = data.disease_info ?? null;
      const status = diseaseInfo?.status === "healthy"
        ? "Healthy Prediction"
        : formattedResult.status;

      setResult({ ...formattedResult, status, diseaseInfo });

      if (!diseaseInfo) {
        console.warn(
          "The backend response did not include disease_info. Check the /predict response in FastAPI docs."
        );
      }
    } catch (err) {
      console.error("Prediction error:", err);
      setError(
        err.message ||
          "Unable to connect to the AI model. Check that the backend is running."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const generateHeatmap = async () => {
    if (!image) return;

    setLoadingHeatmap(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", image);

      const response = await fetch(`${API_BASE}/gradcam`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const details = await response.text();
        throw new Error(`Grad-CAM failed: ${details}`);
      }

      const blob = await response.blob();
      if (!blob.type.includes("image")) {
        throw new Error("The Grad-CAM endpoint did not return an image.");
      }

      const newUrl = URL.createObjectURL(blob);
      setHeatmap((oldUrl) => {
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        return newUrl;
      });
      setShowHeatmap(true);
    } catch (err) {
      console.error("Grad-CAM error:", err);
      setError(
        err.message ||
          "Unable to generate the Grad-CAM heatmap. Check the backend terminal."
      );
    } finally {
      setLoadingHeatmap(false);
    }
  };

  const resetAnalysis = () => {
    setImage(null);
    setPreview(null);
    setResult(null);
    setError("");
    clearHeatmap();
  };

  const scrollToAnalyzer = () => {
    document.getElementById("analyze")?.scrollIntoView({ behavior: "smooth" });
  };

  const isHealthy =
    result?.diseaseInfo?.status === "healthy" ||
    result?.status === "Healthy Prediction";

  const recommendation = isHealthy
    ? "The model predicts that the plant is healthy. Continue appropriate watering, sunlight and regular monitoring."
    : result?.diseaseInfo?.treatment?.[0] ||
      "Inspect affected leaves carefully, avoid wetting foliage unnecessarily, maintain airflow and seek local agricultural advice before choosing a treatment.";

  return (
    <div className="app">
       <WelcomeIntro />
      <nav className="navbar" aria-label="Main navigation">
        <a className="logo" href="#home" aria-label="AI Plant Doctor home">
          <div className="logo-icon"><Leaf size={22} /></div>
          <div>
            <h2>AI Plant Doctor</h2>
            <span>Smart Plant Health</span>
          </div>
        </a>

        <div className="nav-links">
          <a href="#home">Home</a>
          <a href="#analyze">Analyze</a>
          <a href="#features">Features</a>
          <a href="#about">About</a>
        </div>

        <button className="nav-button" onClick={scrollToAnalyzer}>
          <Bot size={17} /> AI Assistant
        </button>
      </nav>

      <section className="hero" id="home">
        <div className="hero-content">
          <div className="badge"><Sparkles size={15} /> AI-Powered Plant Diagnosis</div>
          <h1>Detect Plant Diseases <span>Before It&apos;s Too Late.</span></h1>
          <p>
            Upload a plant leaf image and let our deep learning model identify
            possible diseases and provide useful plant-health insights.
          </p>

          <div className="hero-buttons">
            <button className="primary-btn" onClick={scrollToAnalyzer}>
              Analyze Your Plant <ChevronRight size={19} />
            </button>
            <button
              className="secondary-btn"
              onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
            >
              <Microscope size={18} /> How It Works
            </button>
          </div>

          <div className="supported">
            <span>Supported:</span>
            <b>🍅 Tomato</b>
            <b>🥔 Potato</b>
            <b>🌶️ Pepper</b>
          </div>
        </div>

        <div className="hero-card" aria-label="AI plant scanning illustration">
          <div className="scan-circle"><Leaf size={70} /></div>
          <div className="floating-card card-one">
            <CircleCheck size={18} />
            <div><strong>AI Detection</strong><small>13 Classes</small></div>
          </div>
          <div className="floating-card card-two">
            <Activity size={18} />
            <div><strong>Validation Accuracy</strong><small>80.03%</small></div>
          </div>
        </div>
      </section>

      <section className="stats" aria-label="Project statistics">
        <div><strong>13</strong><span>Disease Classes</span></div>
        <div><strong>80.03%</strong><span>Validation Accuracy</span></div>
        <div><strong>3</strong><span>Plant Types</span></div>
        <div><strong>AI</strong><span>Deep Learning</span></div>
      </section>

      <section className="analyzer-section" id="analyze">
        <div className="section-heading">
          <div className="badge"><ScanSearch size={15} /> Plant Analyzer</div>
          <h2>Analyze Your Plant</h2>
          <p>Upload a clear image of a plant leaf to start the AI analysis.</p>
        </div>

        <div className="analyzer">
          <div className="upload-panel">
            {!preview ? (
              <label className="upload-box">
                <input type="file" accept="image/*" onChange={handleImage} hidden />
                <div className="upload-icon"><Upload size={30} /></div>
                <h3>Upload Leaf Image</h3>
                <p>Click to browse for a clear leaf image.</p>
                <span>PNG, JPG or JPEG · Max 10 MB</span>
              </label>
            ) : (
              <div className="preview-box">
                <img src={preview} alt="Uploaded plant leaf preview" />
                <label className="change-image">
                  Change Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImage}
                    hidden
                    disabled={analyzing || loadingHeatmap}
                  />
                </label>
              </div>
            )}

            <button
              className="analyze-btn"
              onClick={analyzePlant}
              disabled={!image || analyzing || loadingHeatmap}
            >
              {analyzing ? (
                <><LoaderCircle size={19} className="plant-spinner" /> Analyzing...</>
              ) : (
                <><ScanSearch size={19} /> Analyze Plant</>
              )}
            </button>

            {error && (
              <div className="error-message" role="alert">
                <AlertCircle size={17} /> <span>{error}</span>
              </div>
            )}

            {image && (
              <button
                className="reset-btn"
                onClick={resetAnalysis}
                disabled={analyzing || loadingHeatmap}
              >
                <RefreshCw size={16} /> Start New Analysis
              </button>
            )}
          </div>

          <div className="result-panel" aria-live="polite">
            {!result ? (
              <div className="empty-result">
                <div className="result-icon"><Leaf size={35} /></div>
                <h3>Ready for Analysis</h3>
                <p>Upload a plant image and click <b>Analyze Plant</b>.</p>
                <div className="result-features">
                  <span><CircleCheck size={16} /> Disease detection</span>
                  <span><CircleCheck size={16} /> Confidence score</span>
                  <span><CircleCheck size={16} /> Grad-CAM explanation</span>
                </div>
              </div>
            ) : (
              <div className="result">
                <div className="result-header">
                  <div>
                    <span>AI PREDICTION</span>
                    <h2>{result.disease}</h2>
                  </div>
                  <div className="confidence">
                    {Number(result.confidence).toFixed(2)}%
                    <small>confidence</small>
                  </div>
                </div>

                <div className="result-row"><span>Plant</span><strong>{result.plant}</strong></div>
                <div className="result-row"><span>Condition</span><strong>{result.status}</strong></div>
                <div className="confidence-bar">
                  <div style={{ width: `${Math.min(100, Math.max(0, Number(result.confidence) || 0))}%` }} />
                </div>

                <div className="result-card">
                  <h4><ShieldCheck size={18} /> Recommended Action</h4>
                  <p>{recommendation}</p>
                </div>

                {result.diseaseInfo ? (
                  <div className="recommendations-section">
                    <h3>Plant Care Recommendations</h3>
                    {result.diseaseInfo.description && (
                      <p className="disease-description">{result.diseaseInfo.description}</p>
                    )}

                    {Array.isArray(result.diseaseInfo.treatment) && result.diseaseInfo.treatment.length > 0 && (
                      <div className="recommendation-card">
                        <h4><ShieldCheck size={17} /> Treatment &amp; Recommended Actions</h4>
                        <ul>{result.diseaseInfo.treatment.map((item, index) => <li key={`treatment-${index}`}>{item}</li>)}</ul>
                      </div>
                    )}

                    {Array.isArray(result.diseaseInfo.prevention) && result.diseaseInfo.prevention.length > 0 && (
                      <div className="recommendation-card">
                        <h4><Leaf size={17} /> Prevention Tips</h4>
                        <ul>{result.diseaseInfo.prevention.map((item, index) => <li key={`prevention-${index}`}>{item}</li>)}</ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="gradcam-caption">
                    Disease-specific recommendations were not returned by the backend.
                    Check that the /predict response includes disease_info.
                  </p>
                )}
                    
<DiseaseReportButton
  result={result}
  image={image}
  heatmap={heatmap}
/>



                <button
                  className="gradcam-btn"
                  onClick={heatmap ? () => setShowHeatmap((current) => !current) : generateHeatmap}
                  disabled={loadingHeatmap}
                >
                  {loadingHeatmap ? (
                    <><LoaderCircle size={18} className="plant-spinner" /> Generating Heatmap...</>
                  ) : heatmap ? (
                    showHeatmap ? <><EyeOff size={18} /> Hide Grad-CAM Explanation</> : <><Eye size={18} /> Show Grad-CAM Explanation</>
                  ) : (
                    <><Microscope size={18} /> View Grad-CAM Explanation</>
                  )}
                </button>

                {heatmap && showHeatmap && (
                  <div className="gradcam-result">
                    <h4><Microscope size={19} /> AI Attention Heatmap</h4>
                    <p className="gradcam-caption">
                      This overlay visualizes image regions that influence the model&apos;s
                      predicted class. It is an explanation aid, not a definitive disease boundary.
                    </p>
                    <img src={heatmap} alt="Grad-CAM heatmap overlay for the uploaded plant leaf" />
                    <p className="gradcam-caption">
                      Compare the highlighted regions with the visible leaf symptoms. The heatmap
                      does not independently confirm the disease.
                    </p>
                  </div>
                )}

                <p className="model-disclaimer">
                  AI predictions can be affected by image quality and training-data limitations.
                  Confirm serious plant-health issues with an agricultural expert.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
            

      <RecoveryTracker
        currentResult={result}
        currentImage={image}
        apiBase={API_BASE}
      />

      

      <section className="features" id="features">
        <div className="section-heading">
          <div className="badge"><Sparkles size={15} /> Intelligent Features</div>
          <h2>More Than Just Disease Detection</h2>
          <p>AI Plant Doctor combines prediction, explainability and plant-health guidance.</p>
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon"><ScanSearch /></div>
            <h3>AI Disease Detection</h3>
            <p>The trained deep learning model predicts possible plant conditions from leaf images.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><Microscope /></div>
            <h3>Grad-CAM Explainability</h3>
            <p>Visual heatmaps highlight image regions that influenced the AI model&apos;s prediction.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><Bot /></div>
            <h3>Plant Health Assistant</h3>
            <p>Explore general information about symptoms, prevention and plant-care practices.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><Activity /></div>
            <h3>Confidence Analysis</h3>
            <p>View the model&apos;s confidence score alongside the predicted plant condition.</p>
          </div>
        </div>
      </section>

      <section className="how" id="how">
        <div className="section-heading">
          <div className="badge"><Leaf size={15} /> Simple Process</div>
          <h2>How AI Plant Doctor Works</h2>
        </div>
        <div className="steps">
          <div className="step"><span>01</span><Upload /><h3>Upload</h3><p>Upload a clear image of a plant leaf.</p></div>
          <div className="step"><span>02</span><Bot /><h3>AI Analysis</h3><p>The trained model analyzes the image.</p></div>
          <div className="step"><span>03</span><ScanSearch /><h3>Prediction</h3><p>The system displays the predicted condition.</p></div>
          <div className="step"><span>04</span><ShieldCheck /><h3>Explanation</h3><p>Grad-CAM visualizes influential image regions.</p></div>
        </div>
      </section>
      <PlantAssistant />

      <footer id="about">
        <div className="footer-logo"><Leaf /><strong>AI Plant Doctor</strong></div>
        <p>AI-based plant disease detection and explainable plant-health assistance.</p>
        <small>Academic AI/ML Project · 13-Class Plant Disease Detection</small>
      </footer>
    </div>
  );
}

export default App;




{/* <DiseaseReportButton
  result={result}
  image={image}
  heatmap={heatmap}
/> */}
