function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Manager or Executive (booking/staff management — replaces old "manager only")
function requireManager(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (!['manager', 'executive'].includes(req.session.user.role)) return res.redirect('/dashboard');
  next();
}

// Executive only — financial / sensitive areas (T&A, Loans, Audit Log, Backup)
function requireExecutive(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.user.role !== 'executive') return res.redirect('/dashboard');
  next();
}

// Time & Attendance access — Executive always; staff with ta_access flag also allowed
function requireTA(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.user.role === 'executive' || req.session.user.ta_access) return next();
  return res.redirect('/dashboard');
}

module.exports = { requireLogin, requireManager, requireExecutive, requireTA };
