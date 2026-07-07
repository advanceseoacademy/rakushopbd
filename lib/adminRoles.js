const ROLES = {
  SUPER_ADMIN: 'super_admin',
  PRODUCT_EDITOR: 'product_editor',
};

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  product_editor: 'Product Editor',
};

function normalizeAdminRole(role) {
  if (role === ROLES.PRODUCT_EDITOR) return ROLES.PRODUCT_EDITOR;
  return ROLES.SUPER_ADMIN;
}

function isSuperAdminRole(role) {
  return normalizeAdminRole(role) === ROLES.SUPER_ADMIN;
}

function isProductEditorRole(role) {
  return normalizeAdminRole(role) === ROLES.PRODUCT_EDITOR;
}

function formatAdminPublic(row) {
  if (!row) return null;
  const role = normalizeAdminRole(row.role);
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.full_name ?? row.fullName ?? 'Admin',
    role,
    roleLabel: ROLE_LABELS[role] || ROLE_LABELS.super_admin,
    isSuperAdmin: role === ROLES.SUPER_ADMIN,
    isProductEditor: role === ROLES.PRODUCT_EDITOR,
    canDeleteProducts: role === ROLES.SUPER_ADMIN,
  };
}

function isProductDeleteRoute(method, path) {
  const p = String(path || '').split('?')[0];
  if (method === 'DELETE' && /^\/products\/\d+$/.test(p)) return true;
  if (method === 'POST' && p === '/products/bulk-delete') return true;
  return false;
}

function isProductEditorAllowedRoute(method, path) {
  const p = String(path || '').split('?')[0];
  if (isProductDeleteRoute(method, p)) return false;
  const allowed = [
    ['GET', /^\/categories$/],
    ['GET', /^\/products$/],
    ['GET', /^\/products\/export$/],
    ['GET', /^\/products\/\d+$/],
    ['POST', /^\/products$/],
    ['PUT', /^\/products\/\d+$/],
    ['GET', /^\/product-images$/],
    ['POST', /^\/upload$/],
  ];
  return allowed.some(([m, re]) => m === method && re.test(p));
}

module.exports = {
  ROLES,
  ROLE_LABELS,
  normalizeAdminRole,
  isSuperAdminRole,
  isProductEditorRole,
  formatAdminPublic,
  isProductDeleteRoute,
  isProductEditorAllowedRoute,
};
