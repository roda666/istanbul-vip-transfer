import { describe, expect, it } from 'vitest';
import { isSuccessfulVehicleResponse } from '../../lib/vehicle-api-contract';

describe('public fleet response contract', () => {
  it('accepts a legitimate successful empty fleet response', () => {
    expect(isSuccessfulVehicleResponse({ ok: true, status: 200 })).toBe(true);
  });

  it('routes a database-unavailable response to client error handling', () => {
    expect(isSuccessfulVehicleResponse({ ok: false, status: 503 })).toBe(false);
  });
});