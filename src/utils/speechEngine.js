let lastMessage = "";
let lastSpokenTime = 0;

let isPaused = false;
let selectedVoice = null;

let isSpeaking = false;
let pendingMessage = "";

const SAME_MESSAGE_COOLDOWN = 5000;
const DIFFERENT_MESSAGE_COOLDOWN = 1000;

function loadVoice() {
  if (!("speechSynthesis" in window)) return;

  const voices = window.speechSynthesis.getVoices();

  if (!voices.length) return;

  const preferredVoice =
    voices.find((voice) =>
      voice.lang.toLowerCase().startsWith("en-in")
    ) ||
    voices.find((voice) =>
      voice.lang.toLowerCase().startsWith("en-us")
    ) ||
    voices.find((voice) =>
      voice.lang.toLowerCase().startsWith("en-gb")
    ) ||
    voices.find((voice) =>
      voice.lang.toLowerCase().startsWith("en")
    ) ||
    voices[0];

  selectedVoice = preferredVoice;
}

if ("speechSynthesis" in window) {
  loadVoice();

  window.speechSynthesis.onvoiceschanged = loadVoice;
}


/* --------------------------------------------------
   SPEAK GUIDANCE
-------------------------------------------------- */

export function speak(message) {
  if (!message) return;

  if (isPaused) return;

  if (!("speechSynthesis" in window)) return;

  const now = Date.now();

  /*
    Same message:
    Don't repeat it again and again.
  */
  if (
    message === lastMessage &&
    now - lastSpokenTime < SAME_MESSAGE_COOLDOWN
  ) {
    return;
  }

  /*
    IMPORTANT:
    If speech is already playing,
    DO NOT CANCEL IT.

    Store the newest message and wait
    until the current sentence finishes.
  */
  if (isSpeaking || window.speechSynthesis.speaking) {
    pendingMessage = message;
    return;
  }

  /*
    Prevent extremely rapid changes.
  */
  if (
    message !== lastMessage &&
    now - lastSpokenTime < DIFFERENT_MESSAGE_COOLDOWN
  ) {
    pendingMessage = message;
    return;
  }

  speakFullMessage(message);
}


/* --------------------------------------------------
   ACTUALLY SPEAK THE COMPLETE MESSAGE
-------------------------------------------------- */

function speakFullMessage(message) {
  if (!message) return;

  if (isPaused) return;

  if (!("speechSynthesis" in window)) return;

  isSpeaking = true;

  lastMessage = message;
  lastSpokenTime = Date.now();

  /*
    DO NOT cancel here.

    This is the important fix.
    Cancelling here was cutting your sentence short.
  */

  const utterance = new SpeechSynthesisUtterance(message);

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  utterance.lang = "en-IN";

  /*
    Slightly slower speech makes navigation
    instructions easier to understand.
  */
  utterance.rate = 0.85;
  utterance.pitch = 1;
  utterance.volume = 1;

  utterance.onstart = () => {
    isSpeaking = true;
  };

  utterance.onend = () => {
    isSpeaking = false;

    /*
      If detection produced a newer message
      while we were speaking, speak that message
      AFTER the current sentence finishes.
    */
    if (pendingMessage && !isPaused) {
      const nextMessage = pendingMessage;

      pendingMessage = "";

      /*
        Small delay so the two sentences don't
        run into each other.
      */
      setTimeout(() => {
        if (!isPaused) {
          speakFullMessage(nextMessage);
        }
      }, 250);
    }
  };

  utterance.onerror = () => {
    isSpeaking = false;
  };

  window.speechSynthesis.speak(utterance);
}


/* --------------------------------------------------
   PAUSE AUDIO
-------------------------------------------------- */

export function pauseAudio() {
  isPaused = true;

  pendingMessage = "";

  isSpeaking = false;

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}


/* --------------------------------------------------
   RESUME AUDIO
-------------------------------------------------- */

export function resumeAudio() {
  isPaused = false;

  lastMessage = "";
  lastSpokenTime = 0;

  pendingMessage = "";

  isSpeaking = false;
}


/* --------------------------------------------------
   TOGGLE AUDIO
-------------------------------------------------- */

export function toggleAudio() {
  if (isPaused) {
    resumeAudio();
  } else {
    pauseAudio();
  }

  return !isPaused;
}


/* --------------------------------------------------
   CHECK AUDIO STATUS
-------------------------------------------------- */

export function isAudioPaused() {
  return isPaused;
}


/* --------------------------------------------------
   SPEAK IMMEDIATELY
-------------------------------------------------- */

export function speakImmediately(message) {
  if (!message) return;

  if (isPaused) return;

  if (!("speechSynthesis" in window)) return;

  /*
    This function is intentionally allowed to
    interrupt current speech.
  */
  window.speechSynthesis.cancel();

  pendingMessage = "";
  isSpeaking = false;

  const utterance = new SpeechSynthesisUtterance(message);

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  utterance.lang = "en-IN";
  utterance.rate = 0.85;
  utterance.pitch = 1;
  utterance.volume = 1;

  isSpeaking = true;

  utterance.onend = () => {
    isSpeaking = false;
  };

  utterance.onerror = () => {
    isSpeaking = false;
  };

  window.speechSynthesis.speak(utterance);

  lastMessage = message;
  lastSpokenTime = Date.now();
}


/* --------------------------------------------------
   STOP SPEAKING
-------------------------------------------------- */

export function stopSpeaking() {
  pendingMessage = "";
  isSpeaking = false;

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}