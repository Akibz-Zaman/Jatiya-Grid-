import test from 'node:test';
import assert from 'node:assert/strict';
import { BANGLADESH_DIVISIONS } from './bangladeshData';
import {
  computeDivisionThermalZones,
  computeThermalIntensity,
  DIVISION_POLYGONS,
  getThermalStyleForTemperature,
} from './thermalHeatmap';
import { buildWeatherSnapshot } from './weatherService';

test('DIVISION_POLYGONS covers all 8 Bangladesh divisions within valid geographic bounds', () => {
  assert.equal(Object.keys(DIVISION_POLYGONS).length, 8);
  for (const div of BANGLADESH_DIVISIONS) {
    const poly = DIVISION_POLYGONS[div.id];
    assert.ok(poly && poly.length >= 6, `${div.name} polygon should have at least 6 vertices`);
    for (const pt of poly) {
      assert.ok(pt.lat >= 20.5 && pt.lat <= 26.8, `${div.name} lat out of Bangladesh bounds`);
      assert.ok(pt.lng >= 88.0 && pt.lng <= 92.8, `${div.name} lng out of Bangladesh bounds`);
    }
  }
});

test('Thermal intensity increases monotonically and maps temperatures to accurate pressure tiers', () => {
  const cool = getThermalStyleForTemperature(27.0);
  const nominal = getThermalStyleForTemperature(31.5);
  const elevated = getThermalStyleForTemperature(36.2);
  const critical = getThermalStyleForTemperature(41.4);

  assert.equal(cool.pressureTier, 'Cool Relief');
  assert.equal(nominal.pressureTier, 'Nominal');
  assert.equal(elevated.pressureTier, 'Elevated Pressure');
  assert.equal(critical.pressureTier, 'Critical Heatwave');

  assert.ok(cool.intensity < nominal.intensity);
  assert.ok(nominal.intensity < elevated.intensity);
  assert.ok(elevated.intensity < critical.intensity);
  assert.ok(critical.fillOpacity > nominal.fillOpacity);

  // Strict boundary check at 38.0°C vs 38.1°C
  assert.equal(getThermalStyleForTemperature(38.0).pressureTier, 'Elevated Pressure');
  assert.equal(getThermalStyleForTemperature(38.1).pressureTier, 'Critical Heatwave');
  assert.equal(computeThermalIntensity(25.0), 0);
  assert.equal(computeThermalIntensity(42.0), 1);
});

test('computeDivisionThermalZones dynamically shades all 8 divisions across weather profiles', () => {
  const monsoon = computeDivisionThermalZones(buildWeatherSnapshot('monsoon_cool', 0));
  const heatwave = computeDivisionThermalZones(buildWeatherSnapshot('severe_heatwave', 0));

  assert.equal(monsoon.length, 8);
  assert.equal(heatwave.length, 8);

  for (const z of monsoon) {
    assert.equal(z.style.pressureTier, 'Cool Relief');
    assert.equal(z.heatwaveAlert, false);
  }

  const rajshahiHeat = heatwave.find((z) => z.divisionId === 'rajshahi')!;
  const sylhetHeat = heatwave.find((z) => z.divisionId === 'sylhet')!;

  assert.equal(rajshahiHeat.heatwaveAlert, true);
  assert.equal(rajshahiHeat.style.pressureTier, 'Critical Heatwave');
  assert.ok(rajshahiHeat.style.intensity > sylhetHeat.style.intensity);
  assert.ok(rajshahiHeat.hotspotRadiusMeters > sylhetHeat.hotspotRadiusMeters);
});
