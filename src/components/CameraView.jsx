import { useEffect, useRef, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";

import { generateGuidance } from "../utils/detectionLogic";

import {
  speak,
  pauseAudio,
  resumeAudio
} from "../utils/speechEngine";

function CameraView({ onUpdate }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const modelRef = useRef(null);
  const timerRef = useRef(null);

  const runningRef = useRef(false);
  const startingRef = useRef(false);

  const [cameraStatus, setCameraStatus] =
    useState("STARTING");

  const [modelStatus, setModelStatus] =
    useState("LOADING");

  const [error, setError] = useState("");

  const [audioPaused, setAudioPaused] =
    useState(false);

  // ==========================================================
  // AUDIO CONTROLS
  // ==========================================================

  function handlePauseAudio() {
    pauseAudio();
    setAudioPaused(true);
  }

  function handleResumeAudio() {
    resumeAudio();
    setAudioPaused(false);
  }

  // ==========================================================
  // START / CLEANUP
  // ==========================================================

  useEffect(() => {
    runningRef.current = true;

    startCamera();

    return () => {
      runningRef.current = false;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      stopCamera();
      pauseAudio();
    };
  }, []);

  // ==========================================================
  // START CAMERA
  // ==========================================================

  async function startCamera() {
    if (startingRef.current) {
      return;
    }

    startingRef.current = true;

    try {
      setError("");
      setCameraStatus("STARTING");

      stopCamera();

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error(
          "Camera is not supported by this browser."
        );
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: "environment"
            },

            width: {
              ideal: 640
            },

            height: {
              ideal: 480
            }
          },

          audio: false
        });

      if (!runningRef.current) {
        stream
          .getTracks()
          .forEach((track) => track.stop());

        return;
      }

      streamRef.current = stream;

      if (!videoRef.current) {
        throw new Error(
          "Video element is unavailable."
        );
      }

      videoRef.current.srcObject = stream;

      // ======================================================
      // WAIT FOR VIDEO
      // ======================================================

      await new Promise((resolve) => {
        if (
          videoRef.current.readyState >= 2
        ) {
          resolve();
        } else {
          videoRef.current.onloadedmetadata =
            resolve;
        }
      });

      if (!runningRef.current) {
        return;
      }

      await videoRef.current.play();

      setCameraStatus("READY");

      // ======================================================
      // LOAD AI MODEL
      // ======================================================

      setModelStatus("LOADING");

      if (!modelRef.current) {
        modelRef.current =
          await cocoSsd.load({
            base: "lite_mobilenet_v2"
          });
      }

      if (!runningRef.current) {
        return;
      }

      setModelStatus("READY");

      detectObjects();

    } catch (err) {
      console.error(
        "Drishti camera error:",
        err
      );

      setCameraStatus("ERROR");
      setModelStatus("ERROR");

      setError(
        err.message ||
        "Unable to start camera."
      );

    } finally {
      startingRef.current = false;
    }
  }

  // ==========================================================
  // OBJECT DETECTION LOOP
  // ==========================================================

  async function detectObjects() {
    if (!runningRef.current) {
      return;
    }

    if (
      !videoRef.current ||
      !modelRef.current ||
      videoRef.current.readyState < 2
    ) {
      timerRef.current =
        setTimeout(
          detectObjects,
          500
        );

      return;
    }

    try {
      const predictions =
        await modelRef.current.detect(
          videoRef.current,
          20,
          0.35
        );

      if (!runningRef.current) {
        return;
      }

      const width =
        videoRef.current.videoWidth;

      const height =
        videoRef.current.videoHeight;

      // ======================================================
      // KEEP ALL DETECTED OBJECTS
      // ======================================================

      const validPredictions =
        predictions.filter(
          (prediction) =>
            prediction &&
            prediction.score >= 0.35
        );

      // ======================================================
      // GENERATE GUIDANCE
      // ======================================================

      const guidance =
        generateGuidance(
          validPredictions,
          width,
          height
        );

      // ======================================================
      // UPDATE UI
      // ======================================================

      onUpdate({
        predictions:
          validPredictions,

        guidance,

        videoWidth:
          width,

        videoHeight:
          height
      });
      
      speak(guidance.audioMessage || guidance.message);


      // ======================================================
      // AUDIO
      //
      // If audio is paused, speechEngine ignores this.
      // Detection still continues.
      // ======================================================

      if (!audioPaused) {
        speak(guidance.message);
      }

    } catch (err) {
      console.error(
        "Object detection error:",
        err
      );
    }

    // ========================================================
    // NEXT DETECTION
    // ========================================================

    if (runningRef.current) {
      timerRef.current =
        setTimeout(
          detectObjects,
          500
        );
    }
  }

  // ==========================================================
  // STOP CAMERA
  // ==========================================================

  function stopCamera() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => {
          track.stop();
        });

      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  }

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="camera-wrapper">

      {/* CAMERA */}
      <video
        ref={videoRef}
        className="camera"
        autoPlay
        playsInline
        muted
      />

      {/* CAMERA STARTING */}
      {cameraStatus === "STARTING" && (
        <div className="camera-message">
          Starting camera...
        </div>
      )}

      {/* AI LOADING */}
      {modelStatus === "LOADING" &&
        cameraStatus === "READY" && (
          <div className="model-loading">
            Loading AI model...
          </div>
        )}

      {/* ERROR */}
      {error && (
        <div className="camera-error">

          <h3>Camera Error</h3>

          <p>{error}</p>

          <button
            onClick={startCamera}
          >
            TRY AGAIN
          </button>

        </div>
      )}

      {/* ====================================================
          AUDIO CONTROL
          ==================================================== */}

      <div className="audio-controls">

        {!audioPaused ? (
          <button
            className="audio-button"
            onClick={handlePauseAudio}
          >
            🔇 PAUSE AUDIO
          </button>
        ) : (
          <button
            className="audio-button"
            onClick={handleResumeAudio}
          >
            🔊 RESUME AUDIO
          </button>
        )}

      </div>

      {/* ====================================================
          STATUS
          ==================================================== */}

      <div className="status-bar">

        <span>
          Camera: {cameraStatus}
        </span>

        <span>
          AI: {modelStatus}
        </span>

        <span>
          Audio:{" "}
          {audioPaused
            ? "PAUSED"
            : "ON"}
        </span>

      </div>

    </div>
  );
}

export default CameraView;