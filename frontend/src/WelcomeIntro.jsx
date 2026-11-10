import { useEffect, useState } from "react";
import { Leaf, ScanSearch, Sparkles } from "lucide-react";
import "./WelcomeIntro.css";

const INTRO_KEY = "ai-plant-doctor-intro-seen";

export default function WelcomeIntro() {
  const [visible, setVisible] = useState(() => {
    try {
      return window.sessionStorage.getItem(INTRO_KEY) !== "1";
    } catch {
      return false;
    }
  });

  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!visible) return;

    // Remember that the intro has appeared in this tab session.
    try {
      window.sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      // The intro still works if session storage is unavailable.
    }

    const leaveTimer = window.setTimeout(() => {
      setLeaving(true);
    }, 2600);

    const hideTimer = window.setTimeout(() => {
      setVisible(false);
    }, 3300);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, [visible]);

  const skipIntro = () => {
    try {
      window.sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      // Skipping still works without session storage.
    }

    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className={`welcome-intro ${
        leaving ? "welcome-intro--leaving" : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to AI Plant Doctor"
    >
      <div className="welcome-intro__ambient" />

      <button
        type="button"
        className="welcome-intro__skip"
        onClick={skipIntro}
      >
        Skip intro <span aria-hidden="true">→</span>
      </button>

      <div className="welcome-intro__content">
        <div className="welcome-intro__eyebrow">
          <Sparkles size={15} />
          <span>SMART PLANT HEALTH INTELLIGENCE</span>
        </div>

        <div className="welcome-intro__symbol">
          <div className="welcome-intro__ring" />

          <div className="welcome-intro__logo">
            <Leaf size={57} strokeWidth={1.5} />
          </div>

          <div className="welcome-intro__scan-line" />
        </div>

        <p className="welcome-intro__welcome">WELCOME TO</p>

        <h1 className="welcome-intro__title">
          AI Plant <span>Doctor</span>
        </h1>

        <p className="welcome-intro__subtitle">
          Detect. Diagnose. Protect.
        </p>

        <div className="welcome-intro__chip">
          <ScanSearch size={17} />
          <span>AI-powered leaf analysis</span>
          <span className="welcome-intro__status-dot" />
        </div>

        <div
          className="welcome-intro__progress"
          aria-label="Loading homepage"
        >
          <span />
        </div>

        <p className="welcome-intro__footer">
          Plant health, powered by intelligence.
        </p>
      </div>
    </div>
  );
}