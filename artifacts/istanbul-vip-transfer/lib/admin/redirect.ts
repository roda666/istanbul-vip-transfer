/** Return the first protected admin page for a signed-in user's role. */
export function getAdminRedirectPath(role: string): '/admin/sohbet' | '/admin/fiyat-kurallari' {
  return role === 'CHAT_STAFF' ? '/admin/sohbet' : '/admin/fiyat-kurallari';
}