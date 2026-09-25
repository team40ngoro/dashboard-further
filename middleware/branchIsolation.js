/**
 * Enforces Branch Data Scope
 * - If logged in as branch user, locks to user's branch_id.
 * - If in open kiosk / unauthenticated mode or central user, allows flexible filtering by branchId (or null for all).
 */
function enforceBranchScope(req, res, next) {
  const user = req.session ? req.session.user : null;
  const requestedBranch = req.query?.branchId || req.body?.branchId;

  if (user && user.role !== 'admin_pusat' && user.role !== 'analis_pusat' && user.branch_id) {
    req.effectiveBranchId = user.branch_id;
  } else {
    req.effectiveBranchId = (requestedBranch && requestedBranch !== '') ? Number(requestedBranch) : null;
  }

  if (res) {
    res.locals = res.locals || {};
    res.locals.effectiveBranchId = req.effectiveBranchId;
    res.locals.isCentralUser = !user || user.role === 'admin_pusat' || user.role === 'analis_pusat';
    res.locals.currentUser = user;
  }

  next();
}

module.exports = {
  enforceBranchScope
};
