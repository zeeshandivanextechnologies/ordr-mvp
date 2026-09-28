// One set of AI confidence thresholds for the whole app. Below 70 matches the
// backend rule that sends an AI detection to "Needs Review".
export const HIGH_CONFIDENCE = 85;
export const MEDIUM_CONFIDENCE = 70;

export const confidenceLevel = (value) => {
  const v = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(v)) return 'low';
  if (v >= HIGH_CONFIDENCE) return 'high';
  if (v >= MEDIUM_CONFIDENCE) return 'medium';
  return 'low';
};

export const confidenceLabel = (value) => {
  const level = confidenceLevel(value);
  return level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low';
};

// True when the AI gave a score and it is low (the field needs a human check)
export const isLowConfidence = (value) =>
  value !== null && value !== undefined && value !== '' && confidenceLevel(value) === 'low';
