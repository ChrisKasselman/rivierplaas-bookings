function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireManager(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.user.role !== 'manager') return res.redirect('/dashboard');
  next();
}

module.exports = { requireLogin, requireManager };
