import { BANGLADESH_DIVISIONS, SCENARIO_PRESETS } from './bangladeshData';
import { formatBSTTimeShort } from './gridEngine';
import {
  DivisionId,
  DivisionWeatherReading,
  GridControls,
  WeatherCondition,
  WeatherFeedSnapshot,
  WeatherForecastParameters,
  WeatherProfileId,
} from './types';

export const HEATWAVE_TRIGGER_TEMP_C = 38.0;
export const BASELINE_NATIONAL_TEMP_C = 31.4;
export const BASELINE_NATIONAL_DEMAND_MW = 14500;
export const WEATHER_API_ENDPOINT = '/mock-api/v2/bmd-weather/divisions';

interface RawRegionalWeather {
  tempC: number;
  humidityPct: number;
}

export interface WeatherProfilePreset {
  id: WeatherProfileId;
  label: string;
  shortLabel: string;
  description: string;
  regions: Record<DivisionId, RawRegionalWeather>;
}

export const WEATHER_PROFILES: WeatherProfilePreset[] = [
  {
    id: 'seasonal_normal',
    label: 'Seasonal Normal',
    shortLabel: 'Normal 31°C',
    description: 'Typical pre-summer equilibrium across all 8 divisions (peak 32.8°C)',
    regions: {
      dhaka: { tempC: 32.1, humidityPct: 66 },
      chattogram: { tempC: 31.4, humidityPct: 72 },
      rajshahi: { tempC: 32.8, humidityPct: 58 },
      khulna: { tempC: 32.4, humidityPct: 68 },
      mymensingh: { tempC: 30.8, humidityPct: 70 },
      rangpur: { tempC: 30.6, humidityPct: 64 },
      sylhet: { tempC: 29.8, humidityPct: 76 },
      barishal: { tempC: 31.2, humidityPct: 74 },
    },
  },
  {
    id: 'pre_monsoon_warm',
    label: 'Pre-Monsoon Warm',
    shortLabel: 'Warm 36°C',
    description: 'Elevated cooling demand approaching the 38.0°C heatwave trigger (peak 37.4°C)',
    regions: {
      dhaka: { tempC: 36.5, humidityPct: 71 },
      chattogram: { tempC: 35.4, humidityPct: 76 },
      rajshahi: { tempC: 37.4, humidityPct: 61 },
      khulna: { tempC: 36.9, humidityPct: 72 },
      mymensingh: { tempC: 35.1, humidityPct: 73 },
      rangpur: { tempC: 35.6, humidityPct: 67 },
      sylhet: { tempC: 34.2, humidityPct: 78 },
      barishal: { tempC: 35.8, humidityPct: 75 },
    },
  },
  {
    id: 'severe_heatwave',
    label: 'Severe Heatwave',
    shortLabel: 'Heatwave 41°C',
    description: 'Extreme April/May thermal dome exceeding 38.0°C — auto-triggers Heatwave scenario',
    regions: {
      dhaka: { tempC: 40.1, humidityPct: 74 },
      chattogram: { tempC: 38.4, humidityPct: 78 },
      rajshahi: { tempC: 41.4, humidityPct: 56 },
      khulna: { tempC: 40.6, humidityPct: 70 },
      mymensingh: { tempC: 38.6, humidityPct: 72 },
      rangpur: { tempC: 39.0, humidityPct: 64 },
      sylhet: { tempC: 37.8, humidityPct: 75 },
      barishal: { tempC: 39.2, humidityPct: 76 },
    },
  },
  {
    id: 'monsoon_cool',
    label: 'Monsoon Showers',
    shortLabel: 'Monsoon 27°C',
    description: 'Widespread monsoon rainfall reducing regional AC & residential cooling load',
    regions: {
      dhaka: { tempC: 27.8, humidityPct: 86 },
      chattogram: { tempC: 27.1, humidityPct: 90 },
      rajshahi: { tempC: 28.6, humidityPct: 82 },
      khulna: { tempC: 28.1, humidityPct: 87 },
      mymensingh: { tempC: 27.0, humidityPct: 88 },
      rangpur: { tempC: 27.4, humidityPct: 85 },
      sylhet: { tempC: 26.2, humidityPct: 92 },
      barishal: { tempC: 27.5, humidityPct: 89 },
    },
  },
];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function deriveCondition(tempC: number, humidityPct: number, profileId: WeatherProfileId): WeatherCondition {
  if (tempC > HEATWAVE_TRIGGER_TEMP_C) return 'Severe Heatwave';
  if (profileId === 'monsoon_cool' && tempC < 30) return 'Monsoon Rain';
  if (tempC >= 35.0) return 'Humid Haze';
  if (humidityPct >= 75) return 'Partly Cloudy';
  return 'Clear';
}

/**
 * Pure computation mapping regional temperature + humidity readings into
 * Demand Forecast Agent parameters (cooling elasticity, cooling surge MW,
 * 15-minute load ramp, and automatic > 38.0°C heatwave trigger).
 */
export function evaluateWeatherForecastParameters(
  readings: DivisionWeatherReading[],
  thresholdC: number = HEATWAVE_TRIGGER_TEMP_C,
): WeatherForecastParameters {
  let hottest = readings[0];
  let tempSum = 0;
  let humiditySum = 0;
  let totalCoolingSurgeMW = 0;

  for (const reading of readings) {
    if (reading.temperatureC > hottest.temperatureC) {
      hottest = reading;
    }
    tempSum += reading.temperatureC;
    humiditySum += reading.humidityPct;
    totalCoolingSurgeMW += reading.coolingLoadDeltaMW;
  }

  const nationalAvgTempC = round1(tempSum / Math.max(1, readings.length));
  const avgHumidityPct = Math.round(humiditySum / Math.max(1, readings.length));
  const maxTempC = round1(hottest.temperatureC);
  const heatwaveTriggered = maxTempC > thresholdC;

  // Humidity amplifies residential & commercial AC compressor draw (MW per °C nationally)
  const humidityBoost = avgHumidityPct >= 72 ? 1.12 : avgHumidityPct >= 65 ? 1.05 : 1.0;
  const coolingElasticityMwPerC = Math.round(
    (heatwaveTriggered ? 310 : maxTempC >= 35 ? 275 : 235) * humidityBoost,
  );

  // Snap negligible drift around baseline seasonal normal cleanly to 0 MW
  const projectedCoolingSurgeMW =
    Math.abs(totalCoolingSurgeMW) < 40 ? 0 : Math.round(totalCoolingSurgeMW / 10) * 10;

  // 15-minute short-term horizon ramp predicted by the Demand Forecast Agent
  const horizon15MinRampMW = heatwaveTriggered
    ? Math.round(280 + Math.max(0, maxTempC - thresholdC) * 42)
    : projectedCoolingSurgeMW > 0
      ? Math.round(115 + projectedCoolingSurgeMW * 0.08)
      : 85;

  // If severe heatwave triggered, align minimum demand floor with the Heatwave preset (17,000 MW)
  const rawRecommendedDemandMW = BASELINE_NATIONAL_DEMAND_MW + projectedCoolingSurgeMW;
  const recommendedDemandMW = clamp(
    heatwaveTriggered ? Math.max(17000, rawRecommendedDemandMW) : rawRecommendedDemandMW,
    10500,
    19500,
  );

  return {
    heatwaveThresholdC: thresholdC,
    heatwaveTriggered,
    maxTempC,
    nationalAvgTempC,
    avgHumidityPct,
    hottestDivisionId: hottest.divisionId,
    hottestDivisionName: hottest.divisionName,
    coolingElasticityMwPerC,
    projectedCoolingSurgeMW: heatwaveTriggered
      ? Math.max(2500, projectedCoolingSurgeMW)
      : projectedCoolingSurgeMW,
    horizon15MinRampMW,
    recommendedDemandMW: Math.round(recommendedDemandMW / 50) * 50,
  };
}

/**
 * Deterministically builds a complete mock weather snapshot for a given profile and temperature offset.
 * Used for both initial app state and unit tests.
 */
export function buildWeatherSnapshot(
  profileId: WeatherProfileId = 'seasonal_normal',
  tempOffsetC: number = 0,
  now: Date = new Date(),
  autoSyncEnabled: boolean = true,
  jitterByDivision?: Partial<Record<DivisionId, number>>,
): WeatherFeedSnapshot {
  const profile =
    WEATHER_PROFILES.find((p) => p.id === profileId) ?? WEATHER_PROFILES[0];
  const baselineProfile = WEATHER_PROFILES[0];

  const readings: DivisionWeatherReading[] = BANGLADESH_DIVISIONS.map((div) => {
    const raw = profile.regions[div.id];
    const baseRaw = baselineProfile.regions[div.id];
    const jitter = jitterByDivision?.[div.id] ?? 0;

    const temperatureC = round1(clamp(raw.tempC + tempOffsetC + jitter, 18.0, 46.5));
    const humidityPct = Math.round(
      clamp(raw.humidityPct - tempOffsetC * 0.6, 38, 96),
    );
    const feelsLikeC = round1(
      temperatureC + Math.max(0, (humidityPct - 55) * 0.085),
    );
    const heatwaveAlert = temperatureC > HEATWAVE_TRIGGER_TEMP_C;

    // Division cooling load delta relative to seasonal normal baseline temperature
    const deltaFromBaselineC = temperatureC - baseRaw.tempC;
    const regionalElasticity =
      temperatureC > HEATWAVE_TRIGGER_TEMP_C
        ? 315
        : temperatureC >= 34.5
          ? 275
          : 220;
    const coolingLoadDeltaMW = Math.round(
      deltaFromBaselineC * regionalElasticity * div.demandShare,
    );

    return {
      divisionId: div.id,
      divisionName: div.name,
      temperatureC,
      feelsLikeC,
      humidityPct,
      condition: deriveCondition(temperatureC, humidityPct, profileId),
      coolingLoadDeltaMW,
      heatwaveAlert,
    };
  });

  const forecastParams = evaluateWeatherForecastParameters(readings);
  const autoTriggeredHeatwave =
    autoSyncEnabled && forecastParams.heatwaveTriggered;

  return {
    profileId,
    tempOffsetC: round1(tempOffsetC),
    sourceLabel: 'BMD Mock Weather API v2.4',
    endpointUrl: WEATHER_API_ENDPOINT,
    fetchedAtBST: formatBSTTimeShort(now),
    latencyMs: 138,
    autoSyncEnabled,
    autoTriggeredHeatwave,
    readings,
    forecastParams,
  };
}

export interface WeatherControlSyncResult {
  nextControls: GridControls;
  triggeredHeatwave: boolean;
  weatherAdjusted: boolean;
  logMessage: string;
}

/**
 * Applies a WeatherFeedSnapshot to GridControls when Auto-Sync is enabled.
 * Automatically triggers the 'heatwave' scenario whenever regional peak temperature
 * exceeds 38.0°C, and dynamically adjusts forecast demand for warm/cool weather shifts.
 */
export function applyWeatherToGridControls(
  currentControls: GridControls,
  weather: WeatherFeedSnapshot,
): WeatherControlSyncResult {
  const { forecastParams } = weather;

  if (!weather.autoSyncEnabled) {
    return {
      nextControls: currentControls,
      triggeredHeatwave: false,
      weatherAdjusted: false,
      logMessage: `BMD Weather API polled (Peak ${forecastParams.maxTempC.toFixed(1)}°C in ${forecastParams.hottestDivisionName}) — Auto-Sync paused, advisory only.`,
    };
  }

  if (forecastParams.heatwaveTriggered) {
    const heatwavePreset = SCENARIO_PRESETS.find((p) => p.id === 'heatwave')!;
    const nextDemandMW = Math.max(
      heatwavePreset.controls.nationalDemandMW,
      forecastParams.recommendedDemandMW,
    );
    const nextControls: GridControls = {
      mode: currentControls.mode,
      ...heatwavePreset.controls,
      nationalDemandMW: nextDemandMW,
    };

    return {
      nextControls,
      triggeredHeatwave: true,
      weatherAdjusted: true,
      logMessage: `HEATWAVE AUTO-TRIGGER: ${forecastParams.hottestDivisionName} reached ${forecastParams.maxTempC.toFixed(1)}°C (> ${forecastParams.heatwaveThresholdC.toFixed(1)}°C limit) — switched to Peak Summer Heatwave scenario (${nextDemandMW.toLocaleString()} MW demand, +${forecastParams.projectedCoolingSurgeMW.toLocaleString()} MW cooling surge).`,
    };
  }

  // Seasonal normal with zero offset restores clean balanced equilibrium if coming off a weather-driven heatwave or shift
  if (weather.profileId === 'seasonal_normal' && Math.abs(weather.tempOffsetC) < 0.05) {
    const balancedPreset = SCENARIO_PRESETS.find((p) => p.id === 'balanced')!;
    const nextControls: GridControls = {
      mode: currentControls.mode,
      ...balancedPreset.controls,
    };
    return {
      nextControls,
      triggeredHeatwave: false,
      weatherAdjusted: true,
      logMessage: `BMD Weather API normalized (${forecastParams.nationalAvgTempC.toFixed(1)}°C avg, peak ${forecastParams.maxTempC.toFixed(1)}°C) — Demand Forecast restored Balanced National Grid (${balancedPreset.controls.nationalDemandMW.toLocaleString()} MW).`,
    };
  }

  // Non-heatwave warm/cool shift: dynamically adjust Demand Forecast demand target
  const nextControls: GridControls = {
    ...currentControls,
    scenario: currentControls.scenario === 'heatwave' ? 'custom' : currentControls.scenario,
    nationalDemandMW: forecastParams.recommendedDemandMW,
  };
  const surgeSign = forecastParams.projectedCoolingSurgeMW >= 0 ? '+' : '';
  return {
    nextControls,
    triggeredHeatwave: false,
    weatherAdjusted: true,
    logMessage: `BMD Weather API synced (${forecastParams.nationalAvgTempC.toFixed(1)}°C avg, peak ${forecastParams.maxTempC.toFixed(1)}°C in ${forecastParams.hottestDivisionName}) — Demand Forecast adjusted load by ${surgeSign}${forecastParams.projectedCoolingSurgeMW.toLocaleString()} MW to ${forecastParams.recommendedDemandMW.toLocaleString()} MW.`,
  };
}

export interface FetchMockWeatherOptions {
  profileId?: WeatherProfileId;
  tempOffsetC?: number;
  autoSyncEnabled?: boolean;
  jitter?: boolean;
  simulatedDelayMs?: number;
}

/**
 * Simulated asynchronous HTTP Weather API call (BMD regional telemetry service).
 * Resolves with fresh division temperatures, computed Demand Forecast parameters,
 * and simulated response latency.
 */
export async function fetchMockWeatherFeed(
  options: FetchMockWeatherOptions = {},
): Promise<WeatherFeedSnapshot> {
  const {
    profileId = 'seasonal_normal',
    tempOffsetC = 0,
    autoSyncEnabled = true,
    jitter = false,
    simulatedDelayMs = 140,
  } = options;

  const startMs = Date.now();
  if (simulatedDelayMs > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, simulatedDelayMs));
  }

  let jitterByDivision: Partial<Record<DivisionId, number>> | undefined;
  if (jitter) {
    jitterByDivision = {};
    for (const div of BANGLADESH_DIVISIONS) {
      // Subtle ±0.4°C sensor drift on live API refresh
      jitterByDivision[div.id] = round1((Math.random() - 0.5) * 0.8);
    }
  }

  const snapshot = buildWeatherSnapshot(
    profileId,
    tempOffsetC,
    new Date(),
    autoSyncEnabled,
    jitterByDivision,
  );

  return {
    ...snapshot,
    latencyMs: Math.max(92, Date.now() - startMs + 18),
  };
}
