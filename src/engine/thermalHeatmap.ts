import { DivisionId, DivisionWeatherReading, WeatherFeedSnapshot } from './types';
import { HEATWAVE_TRIGGER_TEMP_C } from './weatherService';

export type ThermalPressureTier =
  | 'Cool Relief'
  | 'Nominal'
  | 'Elevated Pressure'
  | 'Critical Heatwave';

export interface ThermalStyle {
  intensity: number; // 0.0 (25°C) to 1.0 (42°C)
  fillHex: string;
  strokeHex: string;
  fillOpacity: number;
  pressureTier: ThermalPressureTier;
  rgb: [number, number, number];
}

export interface DivisionThermalZone {
  divisionId: DivisionId;
  divisionName: string;
  temperatureC: number;
  feelsLikeC: number;
  humidityPct: number;
  coolingLoadDeltaMW: number;
  heatwaveAlert: boolean;
  style: ThermalStyle;
  polygon: Array<{ lat: number; lng: number }>;
  hotspotRadiusMeters: number;
}

/**
 * Clean geographic boundary polygons for all 8 Bangladesh administrative divisions.
 * Adjacent divisions share border control points to form a cohesive national thermal map.
 */
export const DIVISION_POLYGONS: Record<DivisionId, Array<{ lat: number; lng: number }>> = {
  rangpur: [
    { lat: 26.58, lng: 88.42 },
    { lat: 26.32, lng: 89.08 },
    { lat: 26.14, lng: 89.80 },
    { lat: 25.48, lng: 89.84 },
    { lat: 25.12, lng: 89.62 },
    { lat: 25.15, lng: 88.95 },
    { lat: 25.35, lng: 88.45 },
    { lat: 25.85, lng: 88.24 },
  ],
  rajshahi: [
    { lat: 25.35, lng: 88.45 },
    { lat: 25.15, lng: 88.95 },
    { lat: 25.12, lng: 89.62 },
    { lat: 24.48, lng: 89.76 },
    { lat: 23.86, lng: 89.72 },
    { lat: 23.82, lng: 89.18 },
    { lat: 24.08, lng: 88.62 },
    { lat: 24.72, lng: 88.14 },
  ],
  mymensingh: [
    { lat: 25.48, lng: 89.84 },
    { lat: 25.22, lng: 90.42 },
    { lat: 25.18, lng: 91.05 },
    { lat: 24.55, lng: 91.02 },
    { lat: 24.28, lng: 90.62 },
    { lat: 24.25, lng: 89.96 },
    { lat: 24.48, lng: 89.76 },
    { lat: 25.12, lng: 89.62 },
  ],
  sylhet: [
    { lat: 25.18, lng: 91.05 },
    { lat: 25.16, lng: 92.20 },
    { lat: 24.66, lng: 92.40 },
    { lat: 24.16, lng: 91.85 },
    { lat: 24.08, lng: 91.28 },
    { lat: 24.55, lng: 91.02 },
  ],
  dhaka: [
    { lat: 24.48, lng: 89.76 },
    { lat: 24.25, lng: 89.96 },
    { lat: 24.28, lng: 90.62 },
    { lat: 24.55, lng: 91.02 },
    { lat: 24.08, lng: 91.28 },
    { lat: 23.62, lng: 91.15 },
    { lat: 23.22, lng: 90.75 },
    { lat: 23.16, lng: 90.08 },
    { lat: 23.48, lng: 89.56 },
    { lat: 23.86, lng: 89.72 },
  ],
  khulna: [
    { lat: 23.82, lng: 89.18 },
    { lat: 23.86, lng: 89.72 },
    { lat: 23.48, lng: 89.56 },
    { lat: 23.16, lng: 90.08 },
    { lat: 22.62, lng: 89.92 },
    { lat: 21.84, lng: 89.82 },
    { lat: 21.74, lng: 89.18 },
    { lat: 22.25, lng: 88.96 },
    { lat: 23.28, lng: 88.80 },
  ],
  barishal: [
    { lat: 23.16, lng: 90.08 },
    { lat: 23.22, lng: 90.75 },
    { lat: 22.66, lng: 91.02 },
    { lat: 22.12, lng: 90.82 },
    { lat: 21.84, lng: 90.15 },
    { lat: 21.84, lng: 89.82 },
    { lat: 22.62, lng: 89.92 },
  ],
  chattogram: [
    { lat: 24.08, lng: 91.28 },
    { lat: 23.62, lng: 91.15 },
    { lat: 23.22, lng: 90.75 },
    { lat: 22.66, lng: 91.02 },
    { lat: 22.58, lng: 91.42 },
    { lat: 22.10, lng: 91.74 },
    { lat: 21.38, lng: 91.96 },
    { lat: 20.84, lng: 92.34 },
    { lat: 21.95, lng: 92.60 },
    { lat: 22.75, lng: 92.28 },
    { lat: 23.12, lng: 91.62 },
    { lat: 23.70, lng: 91.32 },
  ],
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.round(clamp(v, 0, 255))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Multi-stop perceptual thermal ramp calibrated for a crisp light architectural basemap
const THERMAL_STOPS: Array<{ tempC: number; rgb: [number, number, number] }> = [
  { tempC: 25.0, rgb: [56, 189, 248] },  // Cool sky blue (#38BDF8)
  { tempC: 29.0, rgb: [45, 212, 191] },  // Cool teal (#2DD4BF)
  { tempC: 32.0, rgb: [132, 204, 22] },  // Mild warm lime-green (#84CC16)
  { tempC: 34.5, rgb: [250, 204, 21] },  // Warm yellow (#FACC15)
  { tempC: 37.5, rgb: [249, 115, 22] },  // High cooling orange (#F97316)
  { tempC: 39.5, rgb: [225, 29, 72] },   // Severe heatwave crimson (#E11D48)
  { tempC: 42.5, rgb: [159, 18, 57] },   // Extreme thermal core (#9F1239)
];

export function sampleThermalRgb(tempC: number): [number, number, number] {
  if (tempC <= THERMAL_STOPS[0].tempC) return [...THERMAL_STOPS[0].rgb];
  const last = THERMAL_STOPS[THERMAL_STOPS.length - 1];
  if (tempC >= last.tempC) return [...last.rgb];

  for (let i = 0; i < THERMAL_STOPS.length - 1; i++) {
    const a = THERMAL_STOPS[i];
    const b = THERMAL_STOPS[i + 1];
    if (tempC >= a.tempC && tempC <= b.tempC) {
      const t = (tempC - a.tempC) / (b.tempC - a.tempC);
      return [
        Math.round(lerp(a.rgb[0], b.rgb[0], t)),
        Math.round(lerp(a.rgb[1], b.rgb[1], t)),
        Math.round(lerp(a.rgb[2], b.rgb[2], t)),
      ];
    }
  }
  return [...last.rgb];
}

export function computeThermalIntensity(tempC: number): number {
  return Math.round(clamp((tempC - 25.0) / 17.0, 0, 1) * 1000) / 1000;
}

export function getThermalStyleForTemperature(tempC: number): ThermalStyle {
  const intensity = computeThermalIntensity(tempC);
  const rgb = sampleThermalRgb(tempC);
  const fillHex = rgbToHex(rgb[0], rgb[1], rgb[2]);

  // Darker stroke derived from fill for sharp division boundary readability
  const strokeHex = rgbToHex(rgb[0] * 0.72, rgb[1] * 0.72, rgb[2] * 0.72);

  let pressureTier: ThermalPressureTier = 'Nominal';
  let fillOpacity = 0.28;

  if (tempC > HEATWAVE_TRIGGER_TEMP_C) {
    pressureTier = 'Critical Heatwave';
    fillOpacity = Math.round(lerp(0.42, 0.54, clamp((tempC - 38.0) / 4.5, 0, 1)) * 100) / 100;
  } else if (tempC >= 33.5) {
    pressureTier = 'Elevated Pressure';
    fillOpacity = Math.round(lerp(0.32, 0.42, (tempC - 33.5) / 4.5) * 100) / 100;
  } else if (tempC < 29.0) {
    pressureTier = 'Cool Relief';
    fillOpacity = 0.30;
  } else {
    pressureTier = 'Nominal';
    fillOpacity = 0.25;
  }

  return {
    intensity,
    fillHex,
    strokeHex,
    fillOpacity,
    pressureTier,
    rgb,
  };
}

export function computeDivisionThermalZones(
  weather: WeatherFeedSnapshot,
): DivisionThermalZone[] {
  return weather.readings.map((reading: DivisionWeatherReading) => {
    const style = getThermalStyleForTemperature(reading.temperatureC);
    const hotspotRadiusMeters = reading.heatwaveAlert
      ? Math.round(58000 + Math.max(0, reading.temperatureC - 38.0) * 6500)
      : reading.temperatureC >= 34.5
        ? 44000
        : 32000;

    return {
      divisionId: reading.divisionId,
      divisionName: reading.divisionName,
      temperatureC: reading.temperatureC,
      feelsLikeC: reading.feelsLikeC,
      humidityPct: reading.humidityPct,
      coolingLoadDeltaMW: reading.coolingLoadDeltaMW,
      heatwaveAlert: reading.heatwaveAlert,
      style,
      polygon: DIVISION_POLYGONS[reading.divisionId],
      hotspotRadiusMeters,
    };
  });
}
