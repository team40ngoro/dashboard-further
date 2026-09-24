const { ROLES } = require('../config/constants');

/**
 * Enforces Branch Data Isolation
 * - Branch users (pengunggah_cabang, pembaca_cabang) CANNOT see or upload data for other branches.
 * - Central users (admin_pusat, analis_pusat) can filter by any branch or view all branches.
 */
function enforceBranchScope(req, res, next) {
  const user = req.session ? req.session.user : null;

  if (!user) {
    return next();
  }

  const isCentral = user.role === ROLES.ADMIN_PUSAT || user.role === ROLES.ANALIS_PUSAT;

  if (!isCentral) {
    // Force branch isolation to user's assigned branch_id
    req.effectiveBranchId = user.branch_id;
    if (req.body) req.body.branchId = user.branch_id;
    if (req.query) req.query.branchId = String(user.branch_id);
  } else {
    // Central user can specify branchId or leave null/all
    const requestedBranch = req.query?.branchId || req.body?.branchId;
    req.effectiveBranchId = requestedBranch ? Number(requestedBranch) : null;
  }

  if (res) {
    res.locals = res.locals || {};
    res.locals.effectiveBranchId = req.effectiveBranchId;
    res.locals.isCentralUser = isCentral;
  }

  next();
}

module.exports = {
  enforceBranchScope
};
