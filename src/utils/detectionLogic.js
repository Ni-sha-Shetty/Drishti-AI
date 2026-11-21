// ==========================================================
// DRISHTI AI - DETECTION + GUIDANCE LOGIC
// ==========================================================

const OBSTACLE_CLASSES = new Set([
  "person",
  "bicycle",
  "car",
  "motorcycle",
  "bus",
  "truck",
  "boat",
  "bench",

  "backpack",
  "umbrella",
  "handbag",
  "suitcase",

  "bottle",
  "cup",
  "bowl",

  "chair",
  "couch",
  "potted plant",
  "bed",
  "dining table",

  "toilet",
  "tv",

  "laptop",
  "mouse",
  "remote",
  "keyboard",
  "cell phone",

  "microwave",
  "oven",
  "sink",
  "refrigerator",

  "book",
  "clock",
  "vase"
]);

// ==========================================================
// DISPLAY NAMES
// ==========================================================

const DISPLAY_NAMES = {
  person: "Person",
  bicycle: "Bicycle",
  car: "Car",
  motorcycle: "Motorcycle",
  bus: "Bus",
  truck: "Truck",
  boat: "Boat",
  bench: "Bench",

  backpack: "Backpack",
  umbrella: "Umbrella",
  handbag: "Handbag",
  suitcase: "Suitcase",

  bottle: "Bottle",
  cup: "Cup",
  bowl: "Bowl",

  chair: "Chair",
  couch: "Couch",
  "potted plant": "Plant",
  bed: "Bed",
  "dining table": "Table",

  toilet: "Toilet",
  tv: "TV",

  laptop: "Laptop",
  mouse: "Mouse",
  remote: "Remote",
  keyboard: "Keyboard",
  "cell phone": "Phone",

  microwave: "Microwave",
  oven: "Oven",
  sink: "Sink",
  refrigerator: "Refrigerator",

  book: "Book",
  clock: "Clock",
  vase: "Vase"
};

// ==========================================================
// GET OBJECT POSITION
// ==========================================================

function getZone(bbox, videoWidth) {
  const [x, , width] = bbox;

  const centerX = x + width / 2;

  // Left third
  if (centerX < videoWidth * 0.33) {
    return "LEFT";
  }

  // Right third
  if (centerX > videoWidth * 0.67) {
    return "RIGHT";
  }

  // Middle third
  return "CENTER";
}

// ==========================================================
// GET APPROXIMATE DISTANCE
// ==========================================================

function getProximity(
  bbox,
  videoWidth,
  videoHeight
) {
  const [, , width, height] = bbox;

  const objectArea = width * height;
  const frameArea =
    videoWidth * videoHeight;

  const areaRatio =
    objectArea / frameArea;

  if (areaRatio > 0.25) {
    return "NEAR";
  }

  if (areaRatio > 0.08) {
    return "MEDIUM";
  }

  return "FAR";
}

// ==========================================================
// PREPARE DETECTED OBJECTS
// ==========================================================

function prepareObjects(
  predictions,
  videoWidth,
  videoHeight
) {
  if (!Array.isArray(predictions)) {
    return [];
  }

  return predictions
    .filter(
      (prediction) =>
        prediction &&
        prediction.class &&
        OBSTACLE_CLASSES.has(
          prediction.class
        ) &&
        prediction.score >= 0.35
    )
    .map((prediction) => ({
      ...prediction,

      zone: getZone(
        prediction.bbox,
        videoWidth
      ),

      proximity: getProximity(
        prediction.bbox,
        videoWidth,
        videoHeight
      ),

      displayName:
        DISPLAY_NAMES[
          prediction.class
        ] ||
        prediction.class
    }));
}

// ==========================================================
// REMOVE DUPLICATE / VERY SIMILAR DETECTIONS
// ==========================================================

function cleanObjects(objects) {
  const result = [];

  for (const object of objects) {
    const alreadyExists =
      result.some(
        (existing) =>
          existing.class === object.class &&
          existing.zone === object.zone &&
          Math.abs(
            existing.bbox[0] -
              object.bbox[0]
          ) < 60
      );

    if (!alreadyExists) {
      result.push(object);
    }
  }

  return result;
}

// ==========================================================
// SORT OBJECTS
// ==========================================================

function sortObjects(objects) {
  const proximityPriority = {
    NEAR: 3,
    MEDIUM: 2,
    FAR: 1
  };

  return [...objects].sort(
    (a, b) => {
      const aValue =
        proximityPriority[a.proximity] * 10 +
        a.score;

      const bValue =
        proximityPriority[b.proximity] * 10 +
        b.score;

      return bValue - aValue;
    }
  );
}

// ==========================================================
// CREATE OBJECT DESCRIPTION
// ==========================================================

function describeObject(object) {
  const name =
    object.displayName;

  if (object.zone === "LEFT") {
    return `${name} on your left`;
  }

  if (object.zone === "RIGHT") {
    return `${name} on your right`;
  }

  return `${name} directly ahead`;
}

// ==========================================================
// GET SAFER DIRECTION
// ==========================================================

function getSafeDirection(
  leftObjects,
  rightObjects
) {
  const leftDanger =
    leftObjects.reduce(
      (total, object) =>
        total +
        object.score *
          (object.proximity === "NEAR"
            ? 3
            : object.proximity === "MEDIUM"
            ? 2
            : 1),
      0
    );

  const rightDanger =
    rightObjects.reduce(
      (total, object) =>
        total +
        object.score *
          (object.proximity === "NEAR"
            ? 3
            : object.proximity === "MEDIUM"
            ? 2
            : 1),
      0
    );

  // More space on right
  if (leftDanger > rightDanger) {
    return "RIGHT";
  }

  // More space on left
  if (rightDanger > leftDanger) {
    return "LEFT";
  }

  // Equal danger
  return "CENTER";
}

// ==========================================================
// GENERATE COMPLETE GUIDANCE
// ==========================================================

export function generateGuidance(
  predictions,
  videoWidth,
  videoHeight
) {
  // --------------------------------------------------------
  // Prepare objects
  // --------------------------------------------------------

  let objects =
    prepareObjects(
      predictions,
      videoWidth,
      videoHeight
    );

  objects = cleanObjects(objects);

  objects = sortObjects(objects);

  // --------------------------------------------------------
  // No objects
  // --------------------------------------------------------

  if (objects.length === 0) {
    return {
      message:
        "Path is clear. Continue straight.",

      audioMessage:
        "Path is clear. Continue straight.",

      action: "STRAIGHT",

      zone: "CLEAR",

      proximity: null,

      object: null,

      objects: []
    };
  }

  // --------------------------------------------------------
  // Separate by position
  // --------------------------------------------------------

  const leftObjects =
    objects.filter(
      (object) =>
        object.zone === "LEFT"
    );

  const centerObjects =
    objects.filter(
      (object) =>
        object.zone === "CENTER"
    );

  const rightObjects =
    objects.filter(
      (object) =>
        object.zone === "RIGHT"
    );

  // --------------------------------------------------------
  // Describe ALL important objects
  // --------------------------------------------------------

  const descriptions =
    objects
      .slice(0, 4)
      .map(describeObject);

  // ========================================================
  // CASE 1
  // CENTER IS CLEAR
  // ========================================================

  if (
    centerObjects.length === 0
  ) {
    // ------------------------------------------------------
    // Objects on both sides
    // ------------------------------------------------------

    if (
      leftObjects.length > 0 &&
      rightObjects.length > 0
    ) {
      const message =
        descriptions.join(". ") +
        ". Path is clear in the center. Move forward through the center.";

      return {
        message,

        audioMessage: message,

        action: "CENTER",

        zone: "MULTIPLE",

        proximity:
          objects[0].proximity,

        object: objects[0],

        objects
      };
    }

    // ------------------------------------------------------
    // Only LEFT objects
    // ------------------------------------------------------

    if (
      leftObjects.length > 0 &&
      rightObjects.length === 0
    ) {
      const message =
        descriptions.join(". ") +
        ". Move slightly right.";

      return {
        message,

        audioMessage: message,

        action: "RIGHT",

        zone: "LEFT",

        proximity:
          objects[0].proximity,

        object: objects[0],

        objects
      };
    }

    // ------------------------------------------------------
    // Only RIGHT objects
    // ------------------------------------------------------

    if (
      rightObjects.length > 0 &&
      leftObjects.length === 0
    ) {
      const message =
        descriptions.join(". ") +
        ". Move slightly left.";

      return {
        message,

        audioMessage: message,

        action: "LEFT",

        zone: "RIGHT",

        proximity:
          objects[0].proximity,

        object: objects[0],

        objects
      };
    }
  }

  // ========================================================
  // CASE 2
  // CENTER HAS OBSTACLE
  // ========================================================

  if (
    centerObjects.length > 0
  ) {
    const safeDirection =
      getSafeDirection(
        leftObjects,
        rightObjects
      );

    // ------------------------------------------------------
    // Center obstacle + safer LEFT
    // ------------------------------------------------------

    if (
      safeDirection === "LEFT"
    ) {
      const message =
        descriptions.join(". ") +
        ". Move left.";

      return {
        message,

        audioMessage: message,

        action: "LEFT",

        zone: "CENTER",

        proximity:
          centerObjects[0]
            .proximity,

        object:
          centerObjects[0],

        objects
      };
    }

    // ------------------------------------------------------
    // Center obstacle + safer RIGHT
    // ------------------------------------------------------

    if (
      safeDirection === "RIGHT"
    ) {
      const message =
        descriptions.join(". ") +
        ". Move right.";

      return {
        message,

        audioMessage: message,

        action: "RIGHT",

        zone: "CENTER",

        proximity:
          centerObjects[0]
            .proximity,

        object:
          centerObjects[0],

        objects
      };
    }

    // ------------------------------------------------------
    // Center obstacle + both sides blocked
    // ------------------------------------------------------

    const message =
      descriptions.join(". ") +
      ". Obstacles are blocking the path. Stop.";

    return {
      message,

      audioMessage: message,

      action: "STOP",

      zone: "CENTER",

      proximity:
        centerObjects[0]
          .proximity,

      object:
        centerObjects[0],

      objects
    };
  }

  // ========================================================
  // FALLBACK
  // ========================================================

  const message =
    descriptions.join(". ") +
    ". Continue carefully.";

  return {
    message,

    audioMessage: message,

    action: "STRAIGHT",

    zone: "MULTIPLE",

    proximity:
      objects[0].proximity,

    object: objects[0],

    objects
  };
}