import { useState } from "react";
import {
  CalendarDays,
  Camera,
  Activity,
  CheckCircle2,
  Leaf,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import "./RecoveryTracker.css";

const STORAGE_KEY = "aiPlantDoctorRecoveryRecords_v1";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

function readInitialRecords() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatModelClass(prediction, confidence, diseaseInfo) {
  let plant = "Unknown";
  let disease = prediction || "Unknown";

  if (prediction?.startsWith("Tomato___")) {
    plant = "Tomato";
    disease = prediction.replace("Tomato___", "");
  } else if (prediction?.startsWith("Potato___")) {
    plant = "Potato";
    disease = prediction.replace("Potato___", "");
  } else if (prediction?.startsWith("Pepper,_bell___")) {
    plant = "Pepper";
    disease = prediction.replace("Pepper,_bell___", "");
  }

  disease = disease.replaceAll("_", " ").replaceAll(",", "").trim();
  const healthy = disease.toLowerCase() === "healthy" || diseaseInfo?.status === "healthy";
  return {
    plant,
    disease,
    confidence: Number(confidence) || 0,
    status: healthy ? "Healthy Prediction" : "Potential Disease Detected",
    diseaseInfo: diseaseInfo || null,
  };
}

function compressImage(file, maxDimension = 720, quality = 0.64) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Select an image first."));
      return;
    }
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please select a valid image file."));
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      reject(new Error("Choose an image smaller than 10 MB."));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("This browser cannot process the selected image.");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected image could not be opened."));
    };
    image.src = objectUrl;
  });
}

function prettyDate(value) {
  try {
    return new Date(value).toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Date unavailable";
  }
}

export default function RecoveryTracker({ currentResult, currentImage, apiBase }) {
  const [records, setRecords] = useState(readInitialRecords);
  const [plantLabel, setPlantLabel] = useState("");
  const [savingCurrent, setSavingCurrent] = useState(false);
  const [followupFiles, setFollowupFiles] = useState({});
  const [busyRecordId, setBusyRecordId] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const commitRecords = (nextRecords, successMessage) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
      setRecords(nextRecords);
      setNotice(successMessage);
      setError("");
      return true;
    } catch (storageError) {
      console.error("Recovery tracker storage error:", storageError);
      setError(
        "Browser storage is full or unavailable. Remove an old recovery record and try again. Your existing saved records have not been replaced."
      );
      return false;
    }
  };

  const saveCurrentDiagnosis = async () => {
    if (!currentResult || !currentImage) {
      setError("Run a plant diagnosis before saving it to the Recovery Tracker.");
      return;
    }

    setSavingCurrent(true);
    setError("");
    setNotice("");
    try {
      const imageData = await compressImage(currentImage);
      const now = new Date().toISOString();
      const snapshot = {
        ...currentResult,
        date: now,
        imageData,
      };
      const label = plantLabel.trim() || `${currentResult.plant || "Plant"} plant`;
      const record = {
        id: makeId(),
        label,
        plant: currentResult.plant || "Unknown",
        createdAt: now,
        initial: snapshot,
        checkIns: [],
      };
      const saved = commitRecords([record, ...records], `Saved “${label}” to your Recovery Tracker.`);
      if (saved) setPlantLabel("");
    } catch (saveError) {
      setError(saveError.message || "Could not save this diagnosis.");
    } finally {
      setSavingCurrent(false);
    }
  };

  const handleFollowupFile = (recordId, file) => {
    setNotice("");
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError("Choose a follow-up image smaller than 10 MB.");
      return;
    }
    setFollowupFiles((current) => ({ ...current, [recordId]: file }));
  };

  const addFollowup = async (record) => {
    const file = followupFiles[record.id];
    if (!file) {
      setError("Choose a follow-up photo first.");
      return;
    }
    if (!apiBase) {
      setError("The prediction API URL was not provided.");
      return;
    }

    setBusyRecordId(record.id);
    setError("");
    setNotice("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${apiBase}/predict`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Follow-up analysis failed: ${detail}`);
      }

      const data = await response.json();
      if (!data.prediction || data.confidence === undefined) {
        throw new Error("The backend returned an invalid prediction.");
      }
      const imageData = await compressImage(file);
      const prediction = formatModelClass(data.prediction, data.confidence, data.disease_info);
      const checkIn = {
        id: makeId(),
        date: new Date().toISOString(),
        imageData,
        ...prediction,
      };
      const nextRecords = records.map((item) =>
        item.id === record.id
          ? { ...item, checkIns: [...(item.checkIns || []), checkIn] }
          : item
      );

      if (commitRecords(nextRecords, `Follow-up saved for “${record.label}”.`)) {
        setFollowupFiles((current) => ({ ...current, [record.id]: null }));
      }
    } catch (followupError) {
      console.error("Recovery follow-up error:", followupError);
      setError(followupError.message || "Could not process the follow-up photo.");
    } finally {
      setBusyRecordId(null);
    }
  };

  const deleteRecord = (record) => {
    const confirmed = window.confirm(`Delete the recovery record “${record.label}”? This cannot be undone.`);
    if (!confirmed) return;
    const nextRecords = records.filter((item) => item.id !== record.id);
    commitRecords(nextRecords, `Deleted “${record.label}”.`);
    setFollowupFiles((current) => {
      const next = { ...current };
      delete next[record.id];
      return next;
    });
  };

  return (
    <section className="recovery-section" id="recovery-tracker">
      <div className="recovery-heading">
        <div className="recovery-eyebrow"><Activity size={16} /> PLANT MONITORING</div>
        <h2>Plant Recovery Tracker</h2>
        <p>Save a diagnosis, add follow-up photos, and keep a timeline of plant-health observations.</p>
      </div>

      {currentResult && currentImage && (
        <div className="recovery-save-panel">
          <div className="recovery-save-icon"><Save size={21} /></div>
          <div className="recovery-save-content">
            <h3>Track this diagnosis</h3>
            <p>Save the current result as a plant record so you can add new photos later.</p>
            <label className="recovery-field-label" htmlFor="recovery-plant-label">Plant label (optional)</label>
            <input
              id="recovery-plant-label"
              className="recovery-name-input"
              value={plantLabel}
              onChange={(event) => setPlantLabel(event.target.value)}
              maxLength={60}
              placeholder={`e.g. ${currentResult.plant || "My"} plant - balcony pot`}
            />
            <button className="recovery-primary-btn" onClick={saveCurrentDiagnosis} disabled={savingCurrent}>
              {savingCurrent ? <><LoaderCircle className="recovery-spin" size={17} /> Saving diagnosis...</> : <><Plus size={17} /> Save to Recovery Tracker</>}
            </button>
          </div>
        </div>
      )}

      {notice && <div className="recovery-notice" role="status"><CheckCircle2 size={17} />{notice}</div>}
      {error && <div className="recovery-error" role="alert">{error}</div>}

      {records.length === 0 ? (
        <div className="recovery-empty">
          <div className="recovery-empty-icon"><Leaf size={28} /></div>
          <h3>No tracked plants yet</h3>
          <p>Run a diagnosis above, then choose <strong>Save to Recovery Tracker</strong> to create your first record.</p>
        </div>
      ) : (
        <div className="recovery-record-list">
          {records.map((record) => {
            const timeline = [record.initial, ...(record.checkIns || [])];
            const latest = timeline[timeline.length - 1];
            const file = followupFiles[record.id];
            return (
              <article className="recovery-record" key={record.id}>
                <div className="recovery-record-top">
                  <div>
                    <span className="recovery-record-kicker">{record.plant || "Plant"} · {timeline.length} observation{timeline.length === 1 ? "" : "s"}</span>
                    <h3>{record.label}</h3>
                    <p><CalendarDays size={14} /> Started {prettyDate(record.createdAt)}</p>
                  </div>
                  <button className="recovery-delete-btn" type="button" onClick={() => deleteRecord(record)} aria-label={`Delete ${record.label}`} title="Delete record">
                    <Trash2 size={17} />
                  </button>
                </div>

                <div className="recovery-comparison">
                  <div className="recovery-photo-card">
                    <span>INITIAL PHOTO</span>
                    <img src={record.initial.imageData} alt={`${record.label} initial plant photo`} />
                    <strong>{record.initial.disease}</strong>
                    <small>{Number(record.initial.confidence || 0).toFixed(1)}% confidence</small>
                    <time>{prettyDate(record.initial.date)}</time>
                  </div>
                  <div className="recovery-photo-card recovery-photo-card--latest">
                    <span>{timeline.length > 1 ? "LATEST FOLLOW-UP" : "LATEST OBSERVATION"}</span>
                    <img src={latest.imageData} alt={`${record.label} latest plant photo`} />
                    <strong>{latest.disease}</strong>
                    <small>{Number(latest.confidence || 0).toFixed(1)}% confidence</small>
                    <time>{prettyDate(latest.date)}</time>
                  </div>
                </div>

                <div className="recovery-timeline">
                  <h4><CalendarDays size={16} /> Observation timeline</h4>
                  {timeline.map((entry, index) => (
                    <div className="recovery-timeline-item" key={entry.id || `${entry.date}-${index}`}>
                      <span className="recovery-timeline-dot" />
                      <div>
                        <strong>{index === 0 ? "Initial diagnosis" : `Follow-up ${index}`}</strong>
                        <p>{entry.disease} · {Number(entry.confidence || 0).toFixed(1)}% confidence</p>
                        <time>{prettyDate(entry.date)}</time>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="recovery-followup">
                  <div className="recovery-followup-copy">
                    <h4><Camera size={17} /> Add a follow-up photo</h4>
                    <p>Use a new, clear photo of the same plant. The model will run another prediction and add it to this timeline.</p>
                  </div>
                  <label className="recovery-upload-btn">
                    <Upload size={16} /> Choose photo
                    <input type="file" accept="image/*" onChange={(event) => handleFollowupFile(record.id, event.target.files?.[0])} />
                  </label>
                  {file && <span className="recovery-selected-file">{file.name}</span>}
                  <button className="recovery-primary-btn recovery-followup-submit" onClick={() => addFollowup(record)} disabled={!file || busyRecordId === record.id}>
                    {busyRecordId === record.id ? <><LoaderCircle className="recovery-spin" size={17} /> Analyzing photo...</> : <><Plus size={17} /> Analyze &amp; Save Follow-up</>}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="recovery-disclaimer">A changed label or confidence score does not prove that a plant has recovered. Use the timeline as a record of observations, and consult an agricultural expert if symptoms persist or worsen.</p>
    </section>
  );
}
