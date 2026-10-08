// File-name slug for a duck's name. Pure.
export function slug(name) {
  const cleaned = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'duck';
}
