import { useState } from "react";
import CameraView from "./components/CameraView";
import "./App.css";

function App() {
  const [detectionData, setDetectionData] = useState({
    predictions: [],
    guidance: {
      message: "Starting Drishti AI...",
      object: null,
      zone: "CLEAR",
      proximity: null
    }
  });

  function handleDetectionUpdate(data) {
    setDetectionData(data);
  }

  const guidance = detectionData.guidance;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Drishti AI</h1>
          <p>
            Smart Accessibility Assistant
          </p>
        </div>

        <div className="ai-status">
          ● AI ASSISTANT
        </div>
      </header>

      <main className="main-content">

        <section className="camera-section">

          <CameraView
            onUpdate={handleDetectionUpdate}
          />

        </section>

        <section className="guidance-section">

          <div className="guidance-card">

            <div className="guidance-label">
              CURRENT GUIDANCE
            </div>

            <div className="guidance-message">
              {guidance.message}
            </div>

            <div className="guidance-details">

              <div className="detail">
                <span>OBJECT</span>
                <strong>
                  {guidance.object
                    ? guidance.object.class
                    : "None"}
                </strong>
              </div>

              <div className="detail">
                <span>POSITION</span>
                <strong>
                  {guidance.zone}
                </strong>
              </div>

              <div className="detail">
                <span>PROXIMITY</span>
                <strong>
                  {guidance.proximity || "—"}
                </strong>
              </div>

            </div>

          </div>

        </section>

        <section className="detected-section">

          <h2>
            Detected Objects
          </h2>

          {detectionData.predictions.length === 0 ? (

            <p className="no-objects">
              No supported objects detected
            </p>

          ) : (

            <div className="object-list">

              {detectionData.predictions.map(
                (prediction, index) => (

                  <div
                    className="object-card"
                    key={`${prediction.class}-${index}`}
                  >

                    <strong>
                      {prediction.class}
                    </strong>

                    <span>
                      {Math.round(
                        prediction.score * 100
                      )}% confidence
                    </span>

                  </div>

                )
              )}

            </div>

          )}

        </section>

        <section className="responsible-ai">

          <h2>
            Responsible AI
          </h2>

          <p>
            Drishti AI is an assistive prototype.
            It processes camera information locally
            in the browser and does not identify
            people or store video.
          </p>

          <p>
            AI predictions can be incorrect.
            Always use additional awareness and
            established mobility practices.
          </p>

        </section>

      </main>

      <footer className="app-footer">
        Drishti AI • Responsible AI &
        Inclusive Innovation
      </footer>

    </div>
  );
}

export default App;