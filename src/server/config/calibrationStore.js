const fs = require('fs/promises');
const path = require('path');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('CALCFG');

const CALIBRATION_FILE = (() => {
  const customPath = process.env.HW_CALIBRATION_STATE_PATH;
  if (customPath && typeof customPath === 'string' && customPath.trim() !== '') {
    const resolved = path.resolve(customPath.trim());
    logger.info(`Using custom calibration state path: ${resolved}`);
    return resolved;
  }
  return path.join(__dirname, 'calibrationState.json');
})();

const DEFAULT_WORKFLOW = Object.freeze({
  orientation: {
    gotoComplete: false,
    alignmentReady: false,
    travelReady: false,
    travelComplete: false,
    baselineCaptured: false,
    cornerCaptured: false,
    verified: false
  },
  translation: {
    gotoComplete: false,
    referenceCaptured: false,
    alignedCaptured: false,
    verified: false
  }
});

const DEFAULT_ORIENTATION_VERIFICATION = Object.freeze({
  stage: null,
  cassette1Confirmed: false,
  cassette153Confirmed: false,
  cassette1Pose: null,
  cassette153Pose: null
});

const DEFAULT_STATE = Object.freeze({
  orientation: {
    cassette153Reference: null,
    cassette1Reference: null,
    cassette153Corner: null,
    vectorLengthMm: null,
    alphaDeg: null,
    verified: false,
    lastComputedAt: null,
    verification: DEFAULT_ORIENTATION_VERIFICATION
  },
  translation: {
    cassette1Reference: null,
    cassette1Aligned: null,
    offsetXmm: null,
    offsetYmm: null,
    verified: false,
    lastComputedAt: null
  },
  workflow: DEFAULT_WORKFLOW,
  lastUpdatedAt: null
});

async function ensureFileExists() {
  try {
    await fs.access(CALIBRATION_FILE);
  } catch (err) {
    if (err.code === 'ENOENT') {
      const dir = path.dirname(CALIBRATION_FILE);
      await fs.mkdir(dir, { recursive: true });
      await saveCalibration(DEFAULT_STATE);
    } else {
      throw err;
    }
  }
}

function mergeState(saved) {
  const workflow = {
    orientation: {
      ...DEFAULT_WORKFLOW.orientation,
      ...(saved?.workflow?.orientation || {})
    },
    translation: {
      ...DEFAULT_WORKFLOW.translation,
      ...(saved?.workflow?.translation || {})
    }
  };

  return {
    ...DEFAULT_STATE,
    ...saved,
    orientation: {
      ...DEFAULT_STATE.orientation,
      ...(saved?.orientation || {}),
      verification: {
        ...DEFAULT_ORIENTATION_VERIFICATION,
        ...(saved?.orientation?.verification || {})
      }
    },
    translation: {
      ...DEFAULT_STATE.translation,
      ...(saved?.translation || {})
    },
    workflow
  };
}

function synchroniseWorkflow(state) {
  const wf = state.workflow;
  const orientationState = state.orientation || {};
  const translationState = state.translation || {};

  const hasCassette1Reference = Boolean(orientationState.cassette1Reference);
  const hasCassette153Baseline = Boolean(orientationState.cassette153Reference);
  const hasCassette153Corner = Boolean(orientationState.cassette153Corner);

  wf.orientation.gotoComplete = Boolean(wf.orientation.gotoComplete);
  wf.orientation.alignmentReady = Boolean(wf.orientation.alignmentReady && hasCassette1Reference);
  wf.orientation.travelReady = Boolean(wf.orientation.travelReady);
  wf.orientation.travelComplete = Boolean(wf.orientation.travelComplete);
  wf.orientation.baselineCaptured = hasCassette153Baseline;
  wf.orientation.cornerCaptured = hasCassette153Corner;
  wf.orientation.verified = Boolean(orientationState.verified);

  if (!hasCassette1Reference) {
    wf.orientation.travelReady = false;
    wf.orientation.travelComplete = false;
    wf.orientation.baselineCaptured = false;
    wf.orientation.cornerCaptured = false;
    wf.orientation.verified = false;
  }

  if (wf.orientation.baselineCaptured) {
    wf.orientation.travelReady = true;
    wf.orientation.travelComplete = true;
  } else {
    wf.orientation.cornerCaptured = false;
    wf.orientation.verified = false;
  }

  if (!wf.orientation.cornerCaptured) {
    wf.orientation.verified = false;
  }

  const hasTranslationReference = Boolean(translationState.cassette1Reference);
  const hasTranslationAligned = Boolean(translationState.cassette1Aligned);

  wf.translation.referenceCaptured = hasTranslationReference;
  wf.translation.alignedCaptured = hasTranslationAligned;
  wf.translation.verified = Boolean(translationState.verified);

  wf.translation.gotoComplete = Boolean(wf.translation.gotoComplete);

  if (wf.translation.referenceCaptured) {
    wf.translation.gotoComplete = true;
  }

  if (!wf.translation.referenceCaptured) {
    wf.translation.alignedCaptured = false;
    wf.translation.verified = false;
  }
  if (!wf.translation.alignedCaptured) {
    wf.translation.verified = false;
  }
}

async function loadCalibration() {
  await ensureFileExists();

  try {
    const raw = await fs.readFile(CALIBRATION_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    const merged = mergeState(parsed);
    synchroniseWorkflow(merged);
    return merged;
  } catch (err) {
    logger.error(`Failed to read calibration state (${err.message}). Resetting to defaults.`);
    const reset = mergeState(DEFAULT_STATE);
    synchroniseWorkflow(reset);
    await saveCalibration(reset);
    return reset;
  }
}

async function saveCalibration(state) {
  const normalised = mergeState(state);
  normalised.lastUpdatedAt = new Date().toISOString();
  synchroniseWorkflow(normalised);

  const dir = path.dirname(CALIBRATION_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(CALIBRATION_FILE, JSON.stringify(normalised, null, 2));
  logger.info(`Calibration state persisted to ${CALIBRATION_FILE}`);
  return normalised;
}

async function updateCalibration(updater) {
  const current = await loadCalibration();
  const updated = typeof updater === 'function'
    ? await updater({ ...current })
    : { ...current, ...(updater || {}) };

  return saveCalibration(updated);
}

module.exports = {
  CALIBRATION_FILE,
  DEFAULT_STATE,
  DEFAULT_WORKFLOW,
  DEFAULT_ORIENTATION_VERIFICATION,
  loadCalibration,
  saveCalibration,
  updateCalibration
};
