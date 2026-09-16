import { expect, test, waitForSettledAdminPage } from './fixtures';

const ROUTE_ID = 'beee4b1a-afab-48e6-a585-9d865ded17c8';
const VITO_ID = '954383cc-4d2e-48c0-85a9-73e2423da18f';
const E_CLASS_ID = 'd4030c7c-1bb3-4920-ab9d-b168578b1b1a';
const FERRY_ALTERNATIVE_ID = 'd5d9044a-d9e3-49bf-a597-b5afcb9fd684';
const NON_FERRY_ALTERNATIVE_ID = 'cf0c7e92-d1ef-4a10-a001-5d21945c35c6';
const ORIGIN_LOCATION_ID = 'a3574c8a-abca-4858-81ec-482f83a71efb';
const DESTINATION_LOCATION_ID = '9808de1b-1bb3-429e-b819-cda6f73524c6';

type ComparisonResponse = {
  alternatives: Array<{
    id: string;
    totalKurus: number | null;
    missingTariffPointNames: string[];
    bannedPointNames: string[];
  }>;
};

test('prices the real Istanbul-Bursa ferry and free-road alternative for Mercedes Vito', async ({ adminPage }) => {
  test.setTimeout(120_000);
  await adminPage.goto('/admin/yol-gecis-ucretleri');
  await waitForSettledAdminPage(adminPage);

  const comparisonResponse = await adminPage.request.get(
    `/admin/api/pricing/tolls/route-alternatives/${ROUTE_ID}?vehicleId=${VITO_ID}`,
  );
  expect(comparisonResponse.status()).toBe(200);
  const comparison = await comparisonResponse.json() as ComparisonResponse;
  const ferry = comparison.alternatives.find((alternative) => alternative.id === FERRY_ALTERNATIVE_ID);
  expect(ferry).toMatchObject({
    totalKurus: 153_500,
    missingTariffPointNames: [],
    bannedPointNames: [],
  });

  const quoteResponse = await adminPage.evaluate(async (payload) => {
    const response = await fetch('/admin/api/pricing/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { status: response.status, body: await response.json() };
  }, {
      routeId: ROUTE_ID,
      originLocationId: ORIGIN_LOCATION_ID,
      destinationLocationId: DESTINATION_LOCATION_ID,
      vehicleId: VITO_ID,
      mode: 'DISTANCE',
      tripType: 'ONE_WAY',
      tollAlternativeId: FERRY_ALTERNATIVE_ID,
      serviceType: 'INTERCITY',
  });
  expect(quoteResponse.status).toBe(200);
  const quote = quoteResponse.body as {
    snapshot: {
      tolls: Array<{ name: string; amountKurus: number | null; missing: boolean }>;
    };
  };
  expect(quote.snapshot.tolls).toEqual([
    expect.objectContaining({
      name: 'Fatih Sultan Mehmet Köprüsü (FSM)',
      amountKurus: 7_500,
      missing: false,
    }),
    expect.objectContaining({
      name: 'Eskihisar - Topçular Feribot Hattı (Gebze - Yalova Arası)',
      amountKurus: 146_000,
      missing: false,
    }),
  ]);
  expect(quote.snapshot.tolls.reduce((sum, toll) => sum + (toll.amountKurus ?? 0), 0)).toBe(153_500);

  const secondClassResponse = await adminPage.request.get(
    `/admin/api/pricing/tolls/route-alternatives/${ROUTE_ID}?vehicleId=${E_CLASS_ID}`,
  );
  expect(secondClassResponse.status()).toBe(200);
  const secondClass = await secondClassResponse.json() as ComparisonResponse;
  expect(secondClass.alternatives.find((alternative) => alternative.id === FERRY_ALTERNATIVE_ID)).toMatchObject({
    totalKurus: 90_900,
    missingTariffPointNames: [],
    bannedPointNames: [],
  });
  expect(comparison.alternatives.find((alternative) => alternative.id === NON_FERRY_ALTERNATIVE_ID)).toMatchObject({
    totalKurus: 257_500,
    missingTariffPointNames: [],
    bannedPointNames: [],
  });

  await adminPage.setViewportSize({ width: 1440, height: 1000 });
  await adminPage.getByRole('button', { name: 'Rota Kombinasyonları', exact: true }).click();
  await adminPage.locator('select').first().selectOption(ROUTE_ID);
  const vehicleSelector = adminPage.locator('select').nth(1);
  await expect(vehicleSelector.locator(`option[value="${VITO_ID}"]`)).toHaveCount(1);
  await vehicleSelector.selectOption(VITO_ID);

  const ferryCard = adminPage.getByTestId(`alternative-card-${FERRY_ALTERNATIVE_ID}`);
  await expect(ferryCard).toContainText('Feribot+Ücretsiz Yol');
  await expect(ferryCard).toContainText('Toplam geçiş ücreti: ₺1.535,00');
  await expect(ferryCard).not.toContainText(/Eksik|yasaklı|hesaplanamadı/i);
});