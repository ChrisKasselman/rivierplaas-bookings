function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireManager(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.user.role !== 'manager') return res.redirect('/dashboard');
  next();
}

function requireTA(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  // Managers always have access; staff need ta_access flag
  if (req.session.user.role === 'manager' || req.session.user.ta_access) return next();
  return res.redirect('/dashboard');
}

module.exports = { requireLogin, requireManager, requireTA };
