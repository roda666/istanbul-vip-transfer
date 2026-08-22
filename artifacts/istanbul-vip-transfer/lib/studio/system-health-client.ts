/**
 * A new health probe must never leave a prior successful snapshot visible.
 * The client screen uses this before each fetch and after a failed request.
 */
export function beginSystemHealthRefresh() {
  return { data: null, checkedAt: '' };
}

export function failSystemHealthRefresh() {
  return { data: null, checkedAt: '' };
}