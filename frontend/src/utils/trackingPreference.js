// Module 2: "What do you track?" only shapes the defaults. When the company
// tracks just one side, that order type is pre-selected; both types always stay available.
export const preferredOrderType = (user) => {
  const prefs = Array.isArray(user?.tracking_preferences) ? user.tracking_preferences : [];
  if (prefs.length !== 1) return null;
  if (prefs[0] === 'customer') return 'sales';
  if (prefs[0] === 'supplier') return 'purchase';
  return null;
};
