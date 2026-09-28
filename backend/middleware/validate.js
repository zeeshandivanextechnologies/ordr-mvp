// Request validation helpers.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value) => UUID_RE.test(String(value || ''));

// For router.param('id', uuidParam): a malformed id is simply "not found"
// (instead of reaching the database and failing with a server error).
export const uuidParam = (req, res, next, value) => {
  if (!isUuid(value)) {
    return res.status(404).json({ message: 'Not found', error: 'Not found' });
  }
  next();
};
