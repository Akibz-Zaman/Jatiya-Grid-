import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONTROLS } from './bangladeshData';
import {
  buildAgentNodes,
  computeGridSnapshot,
  createInitialAgentPipeline,
  generateOfficialReportText,
} from './gridEngine';
import {
  applyWeatherToGridControls,
  buildWeatherSnapshot,
  fetchMockWeatherFeed,
  HEATWAVE_TRIGGER_TEMP_C,
} from './weatherService';

test('Seasonal Normal weather maintains 14,500 MW baseline without triggering Heatwave', () => {
  const weather = buildWeatherSnapshot('seasonal_normal', 0, new Date('2026-11-20T06:00:00Z'), true);

  assert.equal(weather.readings.length, 8);
  assert.equal(weather.forecastParams.heatwaveThresholdC, HEATWAVE_TRIGGER_TEMP_C);
  assert.equal(weather.forecastParams.heatwaveTriggered, false);
  assert.equal(weather.autoTriggeredHeatwave, false);
  assert.equal(weather.forecastParams.projectedCoolingSurgeMW, 0);
  assert.equal(weather.forecastParams.recommendedDemandMW, 14500);
  assert.ok(weather.forecastParams.maxTempC <= 38.0);
});

test('Pre-Monsoon Warm raises Demand Forecast cooling load without triggering Heatwave below 38°C', () => {
  const weather = buildWeatherSnapshot('pre_monsoon_warm', 0, new Date('2026-11-20T06:00:00Z'), true);

  assert.ok(weather.forecastParams.maxTempC > 36.0 && weather.forecastParams.maxTempC <= 38.0);
  assert.equal(weather.forecastParams.heatwaveTriggered, false);
  assert.ok(weather.forecastParams.projectedCoolingSurgeMW > 500);

  const sync = applyWeatherToGridControls(DEFAULT_CONTROLS, weather);
  assert.equal(sync.triggeredHeatwave, false);
  assert.equal(sync.weatherAdjusted, true);
  assert.notEqual(sync.nextControls.scenario, 'heatwave');
  assert.ok(sync.nextControls.nationalDemandMW > DEFAULT_CONTROLS.nationalDemandMW);
});

test('Heatwave auto-trigger enforces strict > 38.0°C boundary', () => {
  // Rajshahi baseline in pre_monsoon_warm is 37.4°C -> +0.6°C hits exactly 38.0°C (no trigger)
  const atBoundary = buildWeatherSnapshot('pre_monsoon_warm', 0.6, new Date('2026-11-20T06:00:00Z'), true);
  assert.equal(atBoundary.forecastParams.maxTempC, 38.0);
  assert.equal(atBoundary.forecastParams.heatwaveTriggered, false);

  // +0.7°C pushes Rajshahi to 38.1°C (> 38.0°C -> triggers Heatwave scenario automatically)
  const aboveBoundary = buildWeatherSnapshot('pre_monsoon_warm', 0.7, new Date('2026-11-20T06:00:00Z'), true);
  assert.equal(aboveBoundary.forecastParams.maxTempC, 38.1);
  assert.equal(aboveBoundary.forecastParams.heatwaveTriggered, true);

  const sync = applyWeatherToGridControls(DEFAULT_CONTROLS, aboveBoundary);
  assert.equal(sync.triggeredHeatwave, true);
  assert.equal(sync.nextControls.scenario, 'heatwave');
  assert.ok(sync.nextControls.nationalDemandMW >= 17000);
});

test('Severe Heatwave automatically switches GridControls, updates Demand Forecast agent, and updates Official Report', () => {
  const weather = buildWeatherSnapshot('severe_heatwave', 0, new Date('2026-11-20T06:00:00Z'), true);
  assert.equal(weather.forecastParams.heatwaveTriggered, true);
  assert.ok(weather.forecastParams.maxTempC > 40.0);

  const sync = applyWeatherToGridControls(DEFAULT_CONTROLS, weather);
  assert.equal(sync.triggeredHeatwave, true);
  assert.equal(sync.nextControls.scenario, 'heatwave');
  assert.ok(sync.nextControls.nationalDemandMW >= 17000);

  const snapshot = computeGridSnapshot(sync.nextControls);
  const agents = buildAgentNodes(sync.nextControls, snapshot, 0, weather);
  const forecastAgent = agents.find((a) => a.id === 'forecast')!;

  assert.ok(forecastAgent.primaryMetricValue.includes('°C'));
  assert.ok(forecastAgent.lastAction.includes('Heatwave active'));
  assert.ok(forecastAgent.lastAction.includes('38.0°C'));

  const pipeline = createInitialAgentPipeline(sync.nextControls, snapshot, new Date('2026-11-20T06:00:00Z'), weather);
  const report = generateOfficialReportText(sync.nextControls, snapshot, pipeline, new Date('2026-11-20T06:00:00Z'), weather);
  assert.ok(report.includes('AUTO-TRIGGERED (> 38.0°C)'));
  assert.ok(report.includes('BMD Mock Weather API'));
});

test('Pausing Auto-Sync prevents automatic scenario override when temperature exceeds 38°C', () => {
  const weather = buildWeatherSnapshot('severe_heatwave', 0, new Date('2026-11-20T06:00:00Z'), false);
  assert.equal(weather.forecastParams.heatwaveTriggered, true);
  assert.equal(weather.autoTriggeredHeatwave, false);

  const sync = applyWeatherToGridControls(DEFAULT_CONTROLS, weather);
  assert.equal(sync.triggeredHeatwave, false);
  assert.equal(sync.weatherAdjusted, false);
  assert.equal(sync.nextControls.scenario, DEFAULT_CONTROLS.scenario);
  assert.equal(sync.nextControls.nationalDemandMW, DEFAULT_CONTROLS.nationalDemandMW);
});

test('fetchMockWeatherFeed asynchronously returns 8 division readings and BST timestamp', async () => {
  const feed = await fetchMockWeatherFeed({
    profileId: 'monsoon_cool',
    tempOffsetC: 0,
    autoSyncEnabled: true,
    jitter: false,
    simulatedDelayMs: 5,
  });

  assert.equal(feed.profileId, 'monsoon_cool');
  assert.equal(feed.readings.length, 8);
  assert.ok(feed.fetchedAtBST.includes('BST'));
  assert.ok(feed.forecastParams.projectedCoolingSurgeMW < 0);
  assert.ok(feed.forecastParams.recommendedDemandMW < 14500);
});
