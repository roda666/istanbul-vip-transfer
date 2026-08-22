import { describe, expect, it } from 'vitest';
import { isMissingHealthTableError } from '../../lib/service-health-scheduler';

describe('service health result classification', () => {
  it('recognizes PostgreSQL missing-table errors as a warning condition', () => {
    expect(isMissingHealthTableError({ code: '42P01' })).toBe(true);
    expect(isMissingHealthTableError(new Error('relation "service_health_runs" does not exist'))).toBe(true);
  });

  it('keeps unrelated errors in the failed condition', () => {
    expect(isMissingHealthTableError(new Error('connection refused'))).toBe(false);
  });
});