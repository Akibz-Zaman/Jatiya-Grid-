import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONTROLS, SCENARIO_PRESETS } from './bangladeshData';
import {
  computeGridSnapshot,
  createInitialAgentPipeline,
  generateOfficialReportText,
  stepAgentCycle,
} from './gridEngine';
import { GridControls } from './types';

test('Balanced National Grid holds 50.00 Hz and 100% supply across all 8 divisions', () => {
  const snapshot = computeGridSnapshot(DEFAULT_CONTROLS);

  assert.equal(snapshot.divisions.length, 8);
  assert.equal(snapshot.totalDemandMW, 14500);
  assert.equal(snapshot.totalSupplyMW, 14500);
  assert.equal(snapshot.balancePct, 100);
  assert.equal(snapshot.frequencyHz, 50);

  for (const div of snapshot.divisions) {
    assert.equal(div.supplyPct, 100);
    assert.equal(div.deltaPct, 0);
    assert.equal(div.subZones.length, 4);
    const hospitals = div.subZones.find((z) => z.category === 'hospitals');
    assert.equal(hospitals?.supplyPct, 100);
  }
});

test('Peak Summer Heatwave protects Hospitals at 100% in Autonomous mode and outperforms Manual Override', () => {
  const heatwave = SCENARIO_PRESETS.find((s) => s.id === 'heatwave')!;
  const autoControls: GridControls = { mode: 'autonomous', ...heatwave.controls };
  const manualControls: GridControls = { mode: 'manual', ...heatwave.controls };

  const autoSnap = computeGridSnapshot(autoControls);
  const manualSnap = computeGridSnapshot(manualControls);

  // Autonomous keeps frequency inside [49.80, 50.20] Hz guardrail
  assert.ok(autoSnap.frequencyHz >= 49.8 && autoSnap.frequencyHz <= 50.2);

  // Hospitals locked at 100% across all 8 divisions in Autonomous mode
  for (const div of autoSnap.divisions) {
    const hosp = div.subZones.find((z) => z.category === 'hospitals')!;
    assert.equal(hosp.supplyPct, 100, `${div.name} hospitals must stay 100% protected`);
  }

  // Autonomous mode achieves higher equity index and greater financial savings than Manual Override
  assert.ok(
    autoSnap.financials.equityIndexScore > manualSnap.financials.equityIndexScore,
    'Autonomous AI equity score must exceed Manual Override',
  );
  assert.ok(
    autoSnap.financials.dailyProfitSavedCrore > manualSnap.financials.dailyProfitSavedCrore,
    'Autonomous AI daily savings must exceed Manual Override',
  );
  assert.ok(
    autoSnap.financials.dailyLossWastageCrore < manualSnap.financials.dailyLossWastageCrore,
    'Autonomous AI daily wastage must be lower than Manual Override',
  );
});

test('Rooppur Nuclear Full Ramp (2,400 MW) maximizes peaker fuel reduction and daily savings', () => {
  const balanced = computeGridSnapshot(DEFAULT_CONTROLS);
  const rooppurPreset = SCENARIO_PRESETS.find((s) => s.id === 'rooppur_ramp')!;
  const rooppurSnap = computeGridSnapshot({ mode: 'autonomous', ...rooppurPreset.controls });

  assert.equal(rooppurPreset.controls.rooppurNuclearMW, 2400);
  assert.ok(
    rooppurSnap.financials.peakerFuelReductionPct > balanced.financials.peakerFuelReductionPct,
    'Full 2,400 MW Rooppur nuclear ramp should increase peaker fuel reduction',
  );
  assert.ok(
    rooppurSnap.financials.dailyProfitSavedCrore > balanced.financials.dailyProfitSavedCrore,
    'Full Rooppur ramp should increase daily savings in Crore BDT',
  );
});

test('Generation Deficit Crisis enforces feeder shedding cap and guardrail frequency in Autonomous mode', () => {
  const crisis = SCENARIO_PRESETS.find((s) => s.id === 'deficit_crisis')!;
  const autoSnap = computeGridSnapshot({ mode: 'autonomous', ...crisis.controls });
  const manualSnap = computeGridSnapshot({ mode: 'manual', ...crisis.controls });

  assert.ok(autoSnap.frequencyHz >= 49.8 && autoSnap.frequencyHz <= 50.2);
  assert.ok(manualSnap.frequencyHz < 49.75, 'Manual mode should experience under-frequency droop during crisis');

  // Verify Rangpur rural feeder suffers much less under Autonomous 15-min rotating micro-shedding than Manual legacy
  const autoRangpurRural = autoSnap.divisions
    .find((d) => d.id === 'rangpur')!
    .subZones.find((z) => z.category === 'rural')!;
  const manualRangpurRural = manualSnap.divisions
    .find((d) => d.id === 'rangpur')!
    .subZones.find((z) => z.category === 'rural')!;

  assert.ok(autoRangpurRural.supplyPct > manualRangpurRural.supplyPct);
  assert.equal(autoRangpurRural.rotationWindowMinutes, 15);
  assert.ok(manualRangpurRural.rotationWindowMinutes >= 180);
});

test('stepAgentCycle advances agents, increments cycle counter, and appends BST logs', () => {
  const snap = computeGridSnapshot(DEFAULT_CONTROLS);
  let pipeline = createInitialAgentPipeline(DEFAULT_CONTROLS, snap, new Date('2026-11-20T06:00:00Z'));

  assert.equal(pipeline.cycleCount, 1);
  assert.equal(pipeline.agents.length, 4);

  // Step 4 times to complete a full 4-agent loop
  for (let i = 0; i < 4; i++) {
    pipeline = stepAgentCycle(pipeline, DEFAULT_CONTROLS, snap, new Date(`2026-11-20T06:0${i + 1}:00Z`));
  }

  assert.equal(pipeline.cycleCount, 2);
  assert.ok(pipeline.logs.length >= 8);
  assert.ok(pipeline.logs[0].timestampBST.includes('BST'));
});

test('generateOfficialReportText compiles all 8 divisions, BST timestamp, and financial telemetry', () => {
  const snap = computeGridSnapshot(DEFAULT_CONTROLS);
  const pipeline = createInitialAgentPipeline(DEFAULT_CONTROLS, snap);
  const report = generateOfficialReportText(DEFAULT_CONTROLS, snap, pipeline, new Date('2026-11-20T06:00:00Z'));

  assert.ok(report.includes('JATIYAGRID AI'));
  assert.ok(report.includes('BST'));
  assert.ok(report.includes('50.00 Hz') || report.includes('Hz'));
  assert.ok(report.includes('Crore/day'));
  for (const name of ['Dhaka', 'Chattogram', 'Rajshahi', 'Khulna', 'Mymensingh', 'Rangpur', 'Sylhet', 'Barishal']) {
    assert.ok(report.includes(name), `Report missing division: ${name}`);
  }
});
