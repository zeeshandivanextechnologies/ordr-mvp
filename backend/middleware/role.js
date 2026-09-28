export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      // Both keys: some pages read .error, others read .message
      const msg = 'You do not have permission to perform this action';
      return res.status(403).json({ error: msg, message: msg });
    }

    next();
  };
};

export const requireAdmin = requireRole('admin');
export const requireMember = requireRole('admin', 'member');
