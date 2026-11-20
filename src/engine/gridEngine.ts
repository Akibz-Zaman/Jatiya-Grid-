import { BANGLADESH_DIVISIONS, SCENARIO_PRESETS, TRANSMISSION_CORRIDORS } from './bangladeshData';
import {
  AgentLogEntry,
  AgentNodeState,
  AgentPipelineState,
  CorridorFlowState,
  DivisionState,
  FinancialMetrics,
  GridControls,
  GridSnapshot,
  OperatingMode,
  SubZoneState,
  WeatherFeedSnapshot,
} from './types';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function formatBSTTimestamp(date: Date = new Date()): string {
  // Format as Bangladesh Standard Time (UTC+6) deterministically across all locales
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  const bstDate = new Date(utcMs + 6 * 3600000);
  const pad = (v: number) => String(v).padStart(2, '0');
  const yyyy = bstDate.getFullYear();
  const mm = pad(bstDate.getMonth() + 1);
  const dd = pad(bstDate.getDate());
  const hh = pad(bstDate.getHours());
  const min = pad(bstDate.getMinutes());
  const ss = pad(bstDate.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss} BST`;
}

export function formatBSTTimeShort(date: Date = new Date()): string {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  const bstDate = new Date(utcMs + 6 * 3600000);
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${pad(bstDate.getHours())}:${pad(bstDate.getMinutes())}:${pad(bstDate.getSeconds())} BST`;
}

interface CoreDispatchCalc {
  totalSupplyMW: number;
  nonNuclearDispatchMW: number;
  peakerDispatchMW: number;
  balancePct: number;
  frequencyHz: number;
  frequencyStatus: GridSnapshot['frequencyStatus'];
  divisions: DivisionState[];
  dailySavedCrore: number;
  dailyMwSaved: number;
  dailyWastageCrore: number;
  dailyMwLost: number;
  peakerFuelReductionPct: number;
  equityIndexScore: number;
  avgRuralPct: number;
  avgHospitalsPct: number;
}

/**
 * Pure physics & dispatch solver for a single operating mode (Autonomous AI vs Manual NLDC).
 * Used both for the live selected mode AND to compute exact side-by-side comparison metrics.
 */
function solveGridForMode(controls: GridControls, mode: OperatingMode): CoreDispatchCalc {
  const nonNuclearDispatchMW =
    controls.gasLngMW + controls.coalMW + controls.solarHydroMW + controls.hvdcImportMW;
  const baseSupplyMW = controls.rooppurNuclearMW + nonNuclearDispatchMW;
  const demandMW = Math.max(1000, controls.nationalDemandMW);

  const rawGapMW = demandMW - baseSupplyMW;

  // In Autonomous AI mode, optimal power flow + congestion relief recovers ~1.8% effective capacity during stress
  // while holding exact equilibrium (14,500 MW / 100.0%) when supply already matches demand.
  const aiTransmissionGainMW =
    mode === 'autonomous' && rawGapMW > 0 ? Math.min(rawGapMW, Math.round(baseSupplyMW * 0.018)) : 0;

  // Emergency diesel/HFO peaker dispatch:
  // Manual NLDC over-dispatches expensive HFO/diesel peakers due to 25-45 min telemetry lag
  // and uncoordinated regional balancing. Autonomous AI minimizes peakers via Rooppur + HVDC merit-order.
  let peakerDispatchMW = 0;
  if (mode === 'autonomous') {
    const netShortfall = Math.max(0, rawGapMW - aiTransmissionGainMW);
    // AI uses selective fast-start peakers only for critical buffer up to 24% of gap (capped at 550 MW)
    peakerDispatchMW = Math.round(Math.min(550, netShortfall * 0.24));
  } else {
    // Manual legacy mode keeps ~620 MW spinning HFO/diesel peakers online even at equilibrium
    // and ramps up to 1,150 MW under stress (still lagging behind demand spikes).
    const baselineLegacyPeaker = Math.max(320, Math.round(780 - (controls.rooppurNuclearMW - 350) * 0.16));
    const crisisPeaker = rawGapMW > 0 ? Math.min(650, rawGapMW * 0.28) : 0;
    peakerDispatchMW = Math.round(baselineLegacyPeaker + crisisPeaker);
  }

  // Effective supply delivered to regional buses
  const effectiveSupplyMW =
    mode === 'autonomous'
      ? Math.round(baseSupplyMW + aiTransmissionGainMW + peakerDispatchMW)
      : Math.round(baseSupplyMW + peakerDispatchMW * 0.65 - (rawGapMW > 0 ? Math.min(260, rawGapMW * 0.08) : 0));

  const rawRatio = effectiveSupplyMW / demandMW;
  const nationalDeliveredRatio = clamp(rawRatio, 0.55, 1.0);
  const nationalShortfallRatio = Math.max(0, 1 - nationalDeliveredRatio);

  // Shedding cap enforcement: in Autonomous AI mode, guardrail caps regional shedding smoothly
  const maxShedRatio = controls.feederSheddingCapPct / 100;

  // Compute per-division allocations
  const divisions: DivisionState[] = BANGLADESH_DIVISIONS.map((div) => {
    const divDemandMW = Math.round(demandMW * div.demandShare);

    let divSupplyRatio = 1.0;
    if (nationalShortfallRatio > 0.0005) {
      if (mode === 'autonomous') {
        // Equitable allocation: every division shares proportional micro-shedding within ±1.2% fairness band
        // Slight advantage (+0.8%) for Rooppur / Barishal / Sylhet local bus stability
        const localStabilityBonus =
          div.id === 'rajshahi' && controls.rooppurNuclearMW >= 1800 ? 0.008 : 0;
        const shedFraction = clamp(nationalShortfallRatio - localStabilityBonus, 0, maxShedRatio);
        divSupplyRatio = clamp(1 - shedFraction, 1 - maxShedRatio, 1.0);
      } else {
        // Manual NLDC legacy behavior: heavy bias toward Dhaka & Chattogram while rural divisions
        // (Rangpur, Mymensingh, Barishal, Rajshahi) absorb disproportionate 2x-2.4x blackouts
        const biasFactor = 1 / div.legacyPriorityWeight;
        const biasedShed = clamp(nationalShortfallRatio * Math.pow(biasFactor, 1.85), 0, 0.44);
        divSupplyRatio = clamp(1 - biasedShed, 0.56, 1.0);
      }
    } else if (mode === 'manual' && rawRatio > 1.04) {
      // Slight regional mismatch in manual mode even with surplus
      divSupplyRatio = 1.0;
    }

    const divAllocatedMW = Math.round(divDemandMW * divSupplyRatio);
    const divDeficitMW = Math.max(0, divDemandMW - divAllocatedMW);
    const divSupplyPct = round1(divSupplyRatio * 100);
    const divDeltaPct = round1((divSupplyRatio - 1) * 100);

    // Sub-zone breakdown within the division
    const subZones: SubZoneState[] = div.subZones.map((sz) => {
      const szDemandMW = Math.round(divDemandMW * sz.demandShare);
      let szSupplyRatio = 1.0;
      let protectedFlag = false;
      let rotationWindowMinutes = 0;

      if (mode === 'autonomous') {
        if (sz.category === 'hospitals') {
          // ALWAYS locked at 100% in Autonomous AI mode
          szSupplyRatio = 1.0;
          protectedFlag = true;
          rotationWindowMinutes = 0;
        } else if (sz.category === 'industrial') {
          // EPZs & Industrial protected strongly (max 15% of division deficit share)
          const indShed = divDeficitMW > 0 ? Math.min(0.06, (1 - divSupplyRatio) * 0.35) : 0;
          szSupplyRatio = clamp(1 - indShed, 0.92, 1.0);
          protectedFlag = true;
          rotationWindowMinutes = indShed > 0.005 ? 10 : 0;
        } else if (sz.category === 'cities') {
          const cityShed = divDeficitMW > 0 ? (1 - divSupplyRatio) * 0.95 : 0;
          szSupplyRatio = clamp(1 - cityShed, 0.72, 1.0);
          rotationWindowMinutes = cityShed > 0.01 ? 15 : 0;
        } else {
          // Rural BREB: absorbs balanced micro-shedding via 15-minute automated rotating cuts
          // Calculate residual deficit so division total matches closely
          const ruralShed = divDeficitMW > 0 ? clamp((1 - divSupplyRatio) * 1.45, 0, maxShedRatio * 1.25) : 0;
          szSupplyRatio = clamp(1 - ruralShed, 0.65, 1.0);
          rotationWindowMinutes = ruralShed > 0.01 ? 15 : 0;
        }
      } else {
        // Manual Override Mode: legacy coarse 33kV feeder tripping
        if (sz.category === 'hospitals') {
          // Vulnerable to coarse feeder trips when deficit > 12%
          const hospShed = divSupplyRatio < 0.88 ? (0.88 - divSupplyRatio) * 0.45 : 0;
          szSupplyRatio = clamp(1 - hospShed, 0.84, 1.0);
          protectedFlag = false;
          rotationWindowMinutes = hospShed > 0.01 ? 45 : 0;
        } else if (sz.category === 'cities') {
          const cityShed = (1 - divSupplyRatio) * 0.72;
          szSupplyRatio = clamp(1 - cityShed, 0.65, 1.0);
          rotationWindowMinutes = cityShed > 0.01 ? 90 : 0;
        } else if (sz.category === 'industrial') {
          const indShed = (1 - divSupplyRatio) * 1.05;
          szSupplyRatio = clamp(1 - indShed, 0.58, 1.0);
          rotationWindowMinutes = indShed > 0.01 ? 120 : 0;
        } else {
          // Rural BREB suffers severe 3 to 6-hour rolling blackouts in Manual mode
          const ruralShed = clamp((1 - divSupplyRatio) * 2.15, 0, 0.62);
          szSupplyRatio = clamp(1 - ruralShed, 0.38, 1.0);
          rotationWindowMinutes = ruralShed > 0.02 ? Math.round(180 + ruralShed * 320) : 0;
        }
      }

      const szAllocatedMW = Math.round(szDemandMW * szSupplyRatio);
      const szSupplyPct = round1(szSupplyRatio * 100);
      const szDeltaPct = round1((szSupplyRatio - 1) * 100);

      let szStatus: SubZoneState['status'] = 'nominal';
      if (protectedFlag && szSupplyPct >= 99.5) {
        szStatus = 'protected';
      } else if (szSupplyPct < 70) {
        szStatus = 'blackout';
      } else if (szSupplyPct < 98.5) {
        szStatus = 'rotating';
      }

      return {
        category: sz.category,
        name: sz.name,
        localLabel: sz.localLabel,
        demandMW: szDemandMW,
        allocatedMW: szAllocatedMW,
        supplyPct: szSupplyPct,
        deltaPct: szDeltaPct,
        protected: protectedFlag,
        rotationWindowMinutes,
        position: {
          lat: div.position.lat + sz.latOffset,
          lng: div.position.lng + sz.lngOffset,
        },
        feederCount: sz.feederCount,
        status: szStatus,
      };
    });

    let divStatus: DivisionState['status'] = 'nominal';
    if (divSupplyPct < 80) {
      divStatus = 'critical';
    } else if (divSupplyPct < 95) {
      divStatus = 'shedding';
    } else if (divSupplyPct < 99.5) {
      divStatus = 'elevated';
    }

    return {
      id: div.id,
      name: div.name,
      hubName: div.hubName,
      voltageKv: div.voltageKv,
      archetype: div.archetype,
      position: div.position,
      generationNote: div.generationNote,
      demandMW: divDemandMW,
      allocatedMW: divAllocatedMW,
      deficitMW: divDeficitMW,
      supplyPct: divSupplyPct,
      deltaPct: divDeltaPct,
      status: divStatus,
      subZones,
    };
  });

  // National frequency physics (50.00 Hz nominal)
  // Autonomous Physics & Frequency Guardrail Agent keeps frequency strictly within 49.80 - 50.20 Hz
  const netPowerImbalanceMW = effectiveSupplyMW - demandMW;
  const imbalanceFraction = netPowerImbalanceMW / demandMW;

  let frequencyHz = 50.0;
  if (mode === 'autonomous') {
    // Closed-loop droop + fast micro-shedding keeps deviation tightly damped
    frequencyHz = round2(clamp(50.0 + imbalanceFraction * 0.85, 49.82, 50.18));
    if (Math.abs(imbalanceFraction) < 0.02) {
      frequencyHz = round2(50.0 + imbalanceFraction * 0.25);
    }
  } else {
    // Legacy manual lag allows wider frequency droop/excursion
    frequencyHz = round2(clamp(50.0 + imbalanceFraction * 3.8 - (imbalanceFraction < 0 ? 0.14 : 0), 49.18, 50.52));
  }

  let frequencyStatus: GridSnapshot['frequencyStatus'] = 'Nominal';
  if (frequencyHz < 49.75) {
    frequencyStatus = 'Under-Freq Alert';
  } else if (frequencyHz > 50.25) {
    frequencyStatus = 'Over-Freq Alert';
  } else if (Math.abs(frequencyHz - 50.0) >= 0.08 && mode === 'autonomous') {
    frequencyStatus = 'Guardrail Active';
  }

  // Recompute total allocated & unserved MW across divisions
  const totalAllocatedMW = divisions.reduce((sum, d) => sum + d.allocatedMW, 0);
  const totalUnservedMW = Math.max(0, demandMW - totalAllocatedMW);
  const balancePct = round1(clamp((effectiveSupplyMW / demandMW) * 100, 50, 125));

  // Equity Index (0-100): measures fairness across the 8 divisions (lower spread = higher equity)
  const supplyPcts = divisions.map((d) => d.supplyPct);
  const maxPct = Math.max(...supplyPcts);
  const minPct = Math.min(...supplyPcts);
  const spread = maxPct - minPct;
  const equityIndexScore = round1(clamp(100 - spread * 2.4, 28, 100));

  const avgRuralPct = round1(
    divisions.reduce((sum, d) => sum + (d.subZones.find((z) => z.category === 'rural')?.supplyPct ?? 100), 0) /
      divisions.length,
  );
  const avgHospitalsPct = round1(
    divisions.reduce((sum, d) => sum + (d.subZones.find((z) => z.category === 'hospitals')?.supplyPct ?? 100), 0) /
      divisions.length,
  );

  // Financial & Wastage Telemetry (Bangladeshi Taka ৳ Crore/day)
  // 1 Crore = 10,000,000 BDT.
  // Cost differential: Diesel/HFO peaker ~৳24.5/kWh vs Nuclear/Gas/Solar merit-order ~৳7.2/kWh -> Δ৳17.3/kWh.
  // 1 MW over 24h = 24,000 kWh. At ৳17.3/kWh = ৳415,200/day = 0.04152 Crore BDT/MW-day.
  const peakerCostPerMwDayCrore = 0.0415;
  const unservedEconLossPerMwDayCrore = 0.0285; // Industrial/EPZ productivity loss per MW-day unserved
  const lineLossFactor = mode === 'autonomous' ? 0.052 : 0.084; // Autonomous optimal power flow reduces technical losses
  const transmissionLossMW = Math.round(effectiveSupplyMW * lineLossFactor);

  // Nuclear displacement bonus: high Rooppur baseload cuts imported LNG/HFO fuel bill sharply
  const nuclearDisplacementFactor = clamp((controls.rooppurNuclearMW - 350) / 2050, 0, 1);

  let dailySavedCrore = 0;
  let dailyMwSaved = 0;
  let dailyWastageCrore = 0;
  let dailyMwLost = 0;
  let peakerFuelReductionPct = 0;

  if (mode === 'autonomous') {
    const peakerAvoidedMW = Math.round(520 + nuclearDisplacementFactor * 640 + (rawGapMW > 0 ? Math.min(340, rawGapMW * 0.16) : 0));
    const lossAvoidedMW = Math.round(effectiveSupplyMW * 0.032);
    dailyMwSaved = peakerAvoidedMW + lossAvoidedMW;
    dailySavedCrore = round2(
      peakerAvoidedMW * peakerCostPerMwDayCrore +
        lossAvoidedMW * 0.019 +
        nuclearDisplacementFactor * 6.4,
    );
    dailyMwLost = Math.round(transmissionLossMW * 0.45 + totalUnservedMW * 0.52);
    dailyWastageCrore = round2(
      peakerDispatchMW * (peakerCostPerMwDayCrore * 0.45) +
        totalUnservedMW * (unservedEconLossPerMwDayCrore * 0.35) +
        transmissionLossMW * 0.0085,
    );
    peakerFuelReductionPct = round1(clamp(54 + nuclearDisplacementFactor * 34 - (rawGapMW > 1800 ? 8 : 0), 38, 92));
  } else {
    // Manual legacy NLDC suffers higher HFO peaker burn, line congestion, and unserved industrial EPZ load
    dailyMwSaved = Math.round(110 + nuclearDisplacementFactor * 220);
    dailySavedCrore = round2(dailyMwSaved * 0.022);
    dailyMwLost = Math.round(transmissionLossMW * 0.85 + totalUnservedMW * 0.95 + peakerDispatchMW * 0.35);
    dailyWastageCrore = round2(
      peakerDispatchMW * peakerCostPerMwDayCrore +
        totalUnservedMW * unservedEconLossPerMwDayCrore +
        transmissionLossMW * 0.0155,
    );
    peakerFuelReductionPct = round1(clamp(12 + nuclearDisplacementFactor * 16, 8, 32));
  }

  return {
    totalSupplyMW: effectiveSupplyMW,
    nonNuclearDispatchMW,
    peakerDispatchMW,
    balancePct,
    frequencyHz,
    frequencyStatus,
    divisions,
    dailySavedCrore,
    dailyMwSaved,
    dailyWastageCrore,
    dailyMwLost,
    peakerFuelReductionPct,
    equityIndexScore,
    avgRuralPct,
    avgHospitalsPct,
  };
}

export function computeGridSnapshot(controls: GridControls): GridSnapshot {
  const active = solveGridForMode(controls, controls.mode);
  const autonomousRef =
    controls.mode === 'autonomous' ? active : solveGridForMode(controls, 'autonomous');
  const manualRef =
    controls.mode === 'manual' ? active : solveGridForMode(controls, 'manual');

  const divisionLookup: Record<string, DivisionState> = {};
  for (const div of active.divisions) {
    divisionLookup[div.id] = div;
  }

  // Compute live power flow along the 10 national transmission corridors
  const corridors: CorridorFlowState[] = TRANSMISSION_CORRIDORS.map((cor) => {
    const fromDiv = divisionLookup[cor.from];
    const toDiv = divisionLookup[cor.to];

    let baseFlow = cor.capacityMW * 0.56;
    if (cor.from === 'rajshahi' && cor.to === 'dhaka') {
      // Rooppur Nuclear main artery scales strongly with Rooppur MW
      baseFlow = controls.rooppurNuclearMW * 0.62 + 320;
    } else if (cor.from === 'rajshahi' && cor.to === 'rangpur') {
      baseFlow = controls.rooppurNuclearMW * 0.24 + 260;
    } else if (cor.from === 'rajshahi' && cor.to === 'khulna') {
      baseFlow = controls.rooppurNuclearMW * 0.18 + controls.hvdcImportMW * 0.25;
    } else if (cor.from === 'barishal' && cor.to === 'dhaka') {
      baseFlow = controls.coalMW * 0.34 + 280;
    } else if (cor.from === 'sylhet' && cor.to === 'dhaka') {
      baseFlow = controls.gasLngMW * 0.18 + 190;
    } else if (cor.from === 'dhaka' && cor.to === 'chattogram') {
      baseFlow = (fromDiv.demandMW * 0.22 + toDiv.demandMW * 0.36) * 0.8;
    } else {
      baseFlow = ((fromDiv.allocatedMW + toDiv.allocatedMW) / 2) * 0.38;
    }

    // Manual mode experiences higher corridor congestion (+14%)
    const modeMultiplier = controls.mode === 'manual' ? 1.14 : 0.96;
    const flowMW = Math.round(clamp(baseFlow * modeMultiplier, 120, cor.capacityMW * 0.99));
    const utilizationPct = round1((flowMW / cor.capacityMW) * 100);

    let status: CorridorFlowState['status'] = 'nominal';
    if (utilizationPct >= 86) {
      status = 'congested';
    } else if (utilizationPct >= 72) {
      status = 'loaded';
    }

    return {
      id: cor.id,
      from: cor.from,
      to: cor.to,
      fromPos: fromDiv.position,
      toPos: toDiv.position,
      voltageKv: cor.voltageKv,
      flowMW,
      capacityMW: cor.capacityMW,
      utilizationPct,
      status,
      label: cor.label,
    };
  });

  const annualizedNetGainCrore = round1((active.dailySavedCrore - active.dailyWastageCrore * 0.35) * 365);

  const financials: FinancialMetrics = {
    dailyProfitSavedCrore: active.dailySavedCrore,
    dailyMwSaved: active.dailyMwSaved,
    dailyLossWastageCrore: active.dailyWastageCrore,
    dailyMwLost: active.dailyMwLost,
    annualizedNetGainCrore,
    peakerFuelReductionPct: active.peakerFuelReductionPct,
    peakerDispatchMW: active.peakerDispatchMW,
    equityIndexScore: active.equityIndexScore,
    comparison: {
      autonomousDailySavedCrore: autonomousRef.dailySavedCrore,
      manualDailySavedCrore: manualRef.dailySavedCrore,
      autonomousDailyWastageCrore: autonomousRef.dailyWastageCrore,
      manualDailyWastageCrore: manualRef.dailyWastageCrore,
      autonomousPeakerMW: autonomousRef.peakerDispatchMW,
      manualPeakerMW: manualRef.peakerDispatchMW,
      autonomousRuralAvgPct: autonomousRef.avgRuralPct,
      manualRuralAvgPct: manualRef.avgRuralPct,
      autonomousHospitalsPct: autonomousRef.avgHospitalsPct,
      manualHospitalsPct: manualRef.avgHospitalsPct,
      autonomousFrequencyHz: autonomousRef.frequencyHz,
      manualFrequencyHz: manualRef.frequencyHz,
    },
  };

  return {
    totalSupplyMW: active.totalSupplyMW,
    totalDemandMW: controls.nationalDemandMW,
    nonNuclearDispatchMW: active.nonNuclearDispatchMW,
    peakerDispatchMW: active.peakerDispatchMW,
    reserveMarginMW: active.totalSupplyMW - controls.nationalDemandMW,
    balancePct: active.balancePct,
    frequencyHz: active.frequencyHz,
    frequencyStatus: active.frequencyStatus,
    divisions: active.divisions,
    corridors,
    financials,
  };
}

export function buildAgentNodes(
  controls: GridControls,
  snapshot: GridSnapshot,
  activeAgentIndex: number,
  weather?: WeatherFeedSnapshot,
): AgentNodeState[] {
  const isManual = controls.mode === 'manual';
  const dhaka = snapshot.divisions.find((d) => d.id === 'dhaka')!;
  const rangpur = snapshot.divisions.find((d) => d.id === 'rangpur')!;
  const deficitMW = Math.max(0, snapshot.totalDemandMW - snapshot.totalSupplyMW);
  const freqSafe = snapshot.frequencyHz >= 49.8 && snapshot.frequencyHz <= 50.2;

  const getStatus = (idx: number): AgentNodeState['status'] => {
    if (isManual) return 'bypassed';
    if (idx === activeAgentIndex) return 'active';
    return 'verified';
  };

  const horizonRampMW = weather
    ? weather.forecastParams.horizon15MinRampMW
    : controls.scenario === 'heatwave'
      ? 320
      : 85;
  const peakHorizonMW = snapshot.totalDemandMW + horizonRampMW;

  let forecastLastAction: string;
  if (isManual) {
    forecastLastAction = weather
      ? `Advisory only — BMD Peak ${weather.forecastParams.maxTempC.toFixed(1)}°C (${weather.forecastParams.hottestDivisionName}); manual telemetry active`
      : 'Advisory only — manual operator telemetry active';
  } else if (weather?.forecastParams.heatwaveTriggered) {
    const fp = weather.forecastParams;
    forecastLastAction = `BMD Weather Peak ${fp.maxTempC.toFixed(1)}°C (${fp.hottestDivisionName}) > ${fp.heatwaveThresholdC.toFixed(1)}°C — Heatwave active (+${fp.projectedCoolingSurgeMW.toLocaleString()} MW cooling @ ${fp.coolingElasticityMwPerC} MW/°C)`;
  } else if (weather) {
    const fp = weather.forecastParams;
    const surgeSign = fp.projectedCoolingSurgeMW >= 0 ? '+' : '';
    forecastLastAction = `BMD ${fp.nationalAvgTempC.toFixed(1)}°C avg (Peak ${fp.maxTempC.toFixed(1)}°C ${fp.hottestDivisionName}) · Cooling ${surgeSign}${fp.projectedCoolingSurgeMW.toLocaleString()} MW · Dhaka ${dhaka.demandMW.toLocaleString()} MW`;
  } else {
    forecastLastAction = `Forecasted Dhaka ${dhaka.demandMW.toLocaleString()} MW & Rangpur ${rangpur.demandMW.toLocaleString()} MW within ±0.8% MAE`;
  }

  return [
    {
      id: 'forecast',
      stepNumber: 1,
      name: 'Spatio-Temporal Demand Forecast Agent',
      shortName: 'Demand Forecast',
      role: 'Predicts 15-minute regional load surges across all 8 divisions using BMD regional temperatures, cooling inertia & feeder telemetry.',
      status: getStatus(0),
      latencyMs: isManual ? 0 : weather ? weather.latencyMs : 142,
      primaryMetricLabel: weather ? '15-Min Peak · Weather' : '15-Min Horizon Peak',
      primaryMetricValue: weather
        ? `${peakHorizonMW.toLocaleString()} MW · ${weather.forecastParams.maxTempC.toFixed(1)}°C`
        : `${peakHorizonMW.toLocaleString()} MW`,
      lastAction: forecastLastAction,
    },
    {
      id: 'dispatch',
      stepNumber: 2,
      name: 'Merit-Order & Baseload Dispatch Agent',
      shortName: 'Merit-Order Dispatch',
      role: 'Optimizes Rooppur nuclear baseload, gas CCGT, coal, solar & Bheramara HVDC to displace costly diesel/HFO peakers.',
      status: getStatus(1),
      latencyMs: isManual ? 0 : 186,
      primaryMetricLabel: 'Peaker Fuel Displaced',
      primaryMetricValue: `${snapshot.financials.peakerFuelReductionPct.toFixed(1)}%`,
      lastAction: isManual
        ? 'Manual merit-order queue active (legacy HFO spinning reserve online)'
        : `Locked Rooppur ${controls.rooppurNuclearMW.toLocaleString()} MW + HVDC ${controls.hvdcImportMW.toLocaleString()} MW, saving ৳${snapshot.financials.dailyProfitSavedCrore.toFixed(2)} Cr/day`,
    },
    {
      id: 'shedding',
      stepNumber: 3,
      name: 'Equitable Micro-Shedding Feeder Agent',
      shortName: 'Equitable Feeder',
      role: 'Replaces 6-hour rural blackouts with fair 15-minute rotating cuts while hard-locking hospitals and EPZ feeders ON.',
      status: getStatus(2),
      latencyMs: isManual ? 0 : 118,
      primaryMetricLabel: 'National Equity Index',
      primaryMetricValue: `${snapshot.financials.equityIndexScore.toFixed(1)} / 100`,
      lastAction: isManual
        ? `Manual coarse shedding active — Rangpur BREB at ${rangpur.subZones[3].supplyPct.toFixed(1)}%`
        : deficitMW > 0
          ? `Executing 15-min rotating micro-cuts (${controls.feederSheddingCapPct}% cap); 100% Hospitals & EPZ priority locked`
          : 'Zero load shedding required — all 8 division feeders 100% energized',
    },
    {
      id: 'guardrail',
      stepNumber: 4,
      name: 'Physics & Frequency Safety Guardrail Agent',
      shortName: 'Frequency Guardrail',
      role: 'Verifies AC power-flow N-1 thermal limits and enforces 49.80–50.20 Hz national grid frequency before relay actuation.',
      status: getStatus(3),
      latencyMs: isManual ? 0 : 64,
      primaryMetricLabel: 'Bus Frequency Lock',
      primaryMetricValue: `${snapshot.frequencyHz.toFixed(2)} Hz`,
      lastAction: isManual
        ? freqSafe
          ? 'Manual frequency currently within nominal limits (guardrail bypassed)'
          : `ALERT: Manual frequency excursion at ${snapshot.frequencyHz.toFixed(2)} Hz — AI guardrail bypassed`
        : `AC-OPF verified: ${snapshot.frequencyHz.toFixed(2)} Hz within [49.80, 50.20] Hz envelope; dispatch cleared`,
    },
  ];
}

export function createInitialAgentPipeline(
  controls: GridControls,
  snapshot: GridSnapshot,
  now: Date = new Date(),
  weather?: WeatherFeedSnapshot,
): AgentPipelineState {
  const agents = buildAgentNodes(controls, snapshot, 3, weather);
  const ts = formatBSTTimeShort(now);

  const weatherInitMsg = weather
    ? `Ingested BMD Mock Weather API (${weather.forecastParams.nationalAvgTempC.toFixed(1)}°C national avg, peak ${weather.forecastParams.maxTempC.toFixed(1)}°C in ${weather.forecastParams.hottestDivisionName}) + SCADA vectors (${snapshot.totalDemandMW.toLocaleString()} MW demand).`
    : `Ingested SCADA load vectors for Bangladesh 8 divisions (${snapshot.totalDemandMW.toLocaleString()} MW total national demand).`;

  const logs: AgentLogEntry[] = [
    {
      id: 'init-4',
      cycle: 1,
      timestampBST: ts,
      agentId: 'guardrail',
      agentName: 'Physics & Frequency Guardrail',
      severity: 'guardrail',
      message: `Verified 50.00 Hz nominal synchronization across 10 national 400kV/230kV corridors; zero N-1 thermal violations.`,
    },
    {
      id: 'init-3',
      cycle: 1,
      timestampBST: ts,
      agentId: 'shedding',
      agentName: 'Equitable Micro-Shedding Feeder',
      severity: 'info',
      message: `All 8 divisions balanced at 100.0% supply; Hospitals & Emergency Services locked ON across 85 critical feeders.`,
    },
    {
      id: 'init-2',
      cycle: 1,
      timestampBST: ts,
      agentId: 'dispatch',
      agentName: 'Merit-Order & Baseload Dispatch',
      severity: 'action',
      message: `Scheduled Rooppur Nuclear (${controls.rooppurNuclearMW.toLocaleString()} MW) + Gas/Coal/Solar/HVDC (${snapshot.nonNuclearDispatchMW.toLocaleString()} MW) for minimum peaker burn.`,
    },
    {
      id: 'init-1',
      cycle: 1,
      timestampBST: ts,
      agentId: 'forecast',
      agentName: 'Spatio-Temporal Demand Forecast',
      severity: 'info',
      message: weatherInitMsg,
    },
  ];

  return {
    cycleCount: 1,
    activeAgentIndex: 0,
    autoRun: true,
    agents,
    logs,
  };
}

export function stepAgentCycle(
  prev: AgentPipelineState,
  controls: GridControls,
  snapshot: GridSnapshot,
  now: Date = new Date(),
  weather?: WeatherFeedSnapshot,
): AgentPipelineState {
  const nextIndex = (prev.activeAgentIndex + 1) % 4;
  const nextCycle = nextIndex === 0 ? prev.cycleCount + 1 : prev.cycleCount;
  const agents = buildAgentNodes(controls, snapshot, nextIndex, weather);
  const activeAgent = agents[nextIndex];
  const ts = formatBSTTimeShort(now);

  let severity: AgentLogEntry['severity'] = 'info';
  if (controls.mode === 'manual') {
    severity = snapshot.frequencyHz < 49.75 || snapshot.frequencyHz > 50.25 ? 'warning' : 'info';
  } else if (activeAgent.id === 'forecast' && weather?.forecastParams.heatwaveTriggered) {
    severity = 'warning';
  } else if (activeAgent.id === 'guardrail') {
    severity = 'guardrail';
  } else if (activeAgent.id === 'dispatch' || activeAgent.id === 'shedding') {
    severity = 'action';
  }

  const entry: AgentLogEntry = {
    id: `c${nextCycle}-a${nextIndex}-${now.getTime()}`,
    cycle: nextCycle,
    timestampBST: ts,
    agentId: activeAgent.id,
    agentName: activeAgent.shortName,
    severity,
    message: activeAgent.lastAction,
  };

  return {
    ...prev,
    cycleCount: nextCycle,
    activeAgentIndex: nextIndex,
    agents,
    logs: [entry, ...prev.logs].slice(0, 32),
  };
}

export function getScenarioLabel(scenario: GridControls['scenario']): string {
  const preset = SCENARIO_PRESETS.find((p) => p.id === scenario);
  return preset ? preset.title : 'Custom Operator Profile';
}

export function generateOfficialReportText(
  controls: GridControls,
  snapshot: GridSnapshot,
  pipeline: AgentPipelineState,
  generatedAt: Date = new Date(),
  weather?: WeatherFeedSnapshot,
): string {
  const timestamp = formatBSTTimestamp(generatedAt);
  const modeLabel =
    controls.mode === 'autonomous'
      ? 'AUTONOMOUS AI CLOSED-LOOP CONTROL'
      : 'MANUAL OVERRIDE (LEGACY NLDC SIMULATION)';
  const scenarioLabel = getScenarioLabel(controls.scenario);

  const weatherLines: string[] = weather
    ? [
        `Weather Feed     : ${weather.sourceLabel} (Updated ${weather.fetchedAtBST})`,
        `Regional Peak    : ${weather.forecastParams.maxTempC.toFixed(1)}°C (${weather.forecastParams.hottestDivisionName}) | National Avg: ${weather.forecastParams.nationalAvgTempC.toFixed(1)}°C`,
        `Heatwave Trigger : ${weather.autoTriggeredHeatwave ? `AUTO-TRIGGERED (> ${weather.forecastParams.heatwaveThresholdC.toFixed(1)}°C)` : `Standby (Threshold > ${weather.forecastParams.heatwaveThresholdC.toFixed(1)}°C)`}`,
      ]
    : [];

  const lines: string[] = [
    '================================================================================',
    'JATIYAGRID AI — BANGLADESH NATIONAL GRID OPERATIONAL REPORT',
    'International AI Builders Congress 2026 · Autonomous Grid Simulation & Telemetry',
    '================================================================================',
    `Report Timestamp : ${timestamp}`,
    `Operating Mode   : ${modeLabel}`,
    `Active Scenario  : ${scenarioLabel}`,
    `Agent Cycle      : Cycle #${pipeline.cycleCount}`,
    ...weatherLines,
    '',
    '1. NATIONAL GRID TELEMETRY SUMMARY',
    '--------------------------------------------------------------------------------',
    `National Frequency     : ${snapshot.frequencyHz.toFixed(2)} Hz (${snapshot.frequencyStatus})`,
    `Total Supply Delivered : ${snapshot.totalSupplyMW.toLocaleString()} MW`,
    `Total National Demand  : ${snapshot.totalDemandMW.toLocaleString()} MW`,
    `National Grid Balance  : ${snapshot.balancePct.toFixed(1)}%`,
    `Rooppur Nuclear Load   : ${controls.rooppurNuclearMW.toLocaleString()} MW`,
    `Gas/Coal/Solar/HVDC    : ${snapshot.nonNuclearDispatchMW.toLocaleString()} MW`,
    `Emergency Peaker Load  : ${snapshot.peakerDispatchMW.toLocaleString()} MW`,
    `Feeder Shedding Cap    : ${controls.feederSheddingCapPct}%`,
    '',
    '2. FINANCIAL & EFFICIENCY TELEMETRY (BDT ৳ CRORE)',
    '--------------------------------------------------------------------------------',
    `Daily Profit / Saved   : ৳${snapshot.financials.dailyProfitSavedCrore.toFixed(2)} Crore/day (${snapshot.financials.dailyMwSaved.toLocaleString()} MW saved)`,
    `Daily Loss / Wastage   : ৳${snapshot.financials.dailyLossWastageCrore.toFixed(2)} Crore/day (${snapshot.financials.dailyMwLost.toLocaleString()} MW lost)`,
    `Annualized Net Gain    : ৳${snapshot.financials.annualizedNetGainCrore.toLocaleString()} Crore/year`,
    `Peaker Fuel Reduction  : ${snapshot.financials.peakerFuelReductionPct.toFixed(1)}%`,
    `National Equity Index  : ${snapshot.financials.equityIndexScore.toFixed(1)} / 100`,
    '',
    '3. AUTONOMOUS MULTI-AGENT PIPELINE STATUS',
    '--------------------------------------------------------------------------------',
    ...pipeline.agents.map(
      (a) =>
        `[0${a.stepNumber}] ${a.name} — ${a.status.toUpperCase()} | ${a.primaryMetricLabel}: ${a.primaryMetricValue}`,
    ),
    '',
    '4. REGIONAL 8-DIVISION & SUB-ZONE ALLOCATION MATRIX',
    '--------------------------------------------------------------------------------',
  ];

  for (const div of snapshot.divisions) {
    const sign = div.deltaPct > 0 ? '+' : '';
    lines.push(
      `${div.name.padEnd(12)} | Hub: ${div.hubName.padEnd(32)} | ${String(div.allocatedMW).padStart(5)} / ${String(div.demandMW).padStart(5)} MW | ${div.supplyPct.toFixed(1)}% (${sign}${div.deltaPct.toFixed(1)}%)`,
    );
    const szSummary = div.subZones
      .map((sz) => `${sz.name}: ${sz.supplyPct.toFixed(1)}%`)
      .join(' | ');
    lines.push(`   Sub-Zones -> ${szSummary}`);
  }

  lines.push(
    '================================================================================',
    'Note: Operational simulation telemetry generated by JatiyaGrid AI control engine.',
    '================================================================================',
  );

  return lines.join('\n');
}
