import { describe, expect, it } from 'vitest';
import { appliesToServiceType } from '@/lib/optional-booking-fields';

describe('optional booking field service applicability', () => {
  it('keeps legacy rows without a mapping visible to every service', () => {
    expect(appliesToServiceType(undefined, 'showLuggageCount', 'TOUR')).toBe(true);
  });

  it('only enables mapped services and permits an explicit empty selection', () => {
    const mapping = { showVehiclePreference: ['ALLOCATION'] };
    expect(appliesToServiceType(mapping, 'showVehiclePreference', 'ALLOCATION')).toBe(true);
    expect(appliesToServiceType(mapping, 'showVehiclePreference', 'TOUR')).toBe(false);
    expect(appliesToServiceType({ showAdditionalNotes: [] }, 'showAdditionalNotes', 'TOUR')).toBe(false);
  });
});