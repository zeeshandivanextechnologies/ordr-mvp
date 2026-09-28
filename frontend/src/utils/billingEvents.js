// Tells billing-aware components (e.g. the trial banner) to reload plan and usage
const EVENT = 'ordr:billing-changed';

export const notifyBillingChanged = () => window.dispatchEvent(new Event(EVENT));

export const onBillingChanged = (handler) => {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
};
