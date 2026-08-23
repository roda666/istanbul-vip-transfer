/** Public fleet endpoint contract helpers, shared by browser fetch tests. */
export function isSuccessfulVehicleResponse(response: Pick<Response, 'ok' | 'status'>): boolean {
  return response.ok && response.status >= 200 && response.status < 300;
}