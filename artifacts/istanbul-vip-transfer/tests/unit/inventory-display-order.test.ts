import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

describe('shared inventory display ordering contracts', () => {
  it('defines the canonical vehicle and transfer-route query order', () => {
    const helper = read('lib/inventory-order.ts');
    expect(helper).toMatch(
      /asc\(vehicles\.displayOrder\), asc\(vehicles\.name\), asc\(vehicles\.id\)/,
    );
    expect(helper).toMatch(
      /asc\(transferRoutes\.displayOrder\), asc\(transferRoutes\.name\), asc\(transferRoutes\.id\)/,
    );
  });

  it('uses canonical ordering for public and selector collections', () => {
    for (const file of [
      'app/admin/api/transfer-routes/route.ts',
      'app/admin/api/pricing/profiles/route.ts',
      'app/admin/api/price-rules/route.ts',
      'lib/booking-form-bootstrap.ts',
      'app/data/vehicles/route.ts',
      'components/VehiclesPageContent.tsx',
      'lib/transfer-route-pages.ts',
    ]) {
      expect(read(file), file).toMatch(/vehicleDisplayOrder|transferRouteDisplayOrder/);
    }
  });

  it('keeps explicit admin vehicle primary sort while adding stable tie-breakers', () => {
    const route = read('app/admin/api/vehicles/route.ts');
    expect(route).toContain('requestedSort == null');
    expect(route).toContain('!hasExplicitSort && sort === \'displayOrder\'');
    expect(route).toContain('adminVehicleOrder(sort, order)');
    expect(read('lib/inventory-order.ts')).toMatch(
      /primary[\s\S]*asc\(vehicles\.name\), asc\(vehicles\.id\)/,
    );
  });

  it('keeps fast-quote toll alternatives default-first with deterministic ties', () => {
    const tollManagement = read('lib/toll-management.ts');
    expect(tollManagement).toMatch(
      /desc\(routeTollAlternatives\.isDefault\)[\s\S]*asc\(routeTollAlternatives\.displayOrder\)[\s\S]*asc\(routeTollAlternatives\.name\)[\s\S]*asc\(routeTollAlternatives\.id\)/,
    );
    expect(read('lib/admin-fast-quote.ts')).toContain('left.id.localeCompare(right.id)');
  });
});