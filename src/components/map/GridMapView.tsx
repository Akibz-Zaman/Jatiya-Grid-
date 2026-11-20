import React, { useState } from 'react';
import {
  Box,
  ChevronDown,
  ChevronUp,
  Flame,
  Globe,
  MapPin,
  RotateCcw,
  Thermometer,
} from 'lucide-react';
import { SCENARIO_PRESETS } from '../../engine/bangladeshData';
import {
  DivisionId,
  GridControls,
  GridSnapshot,
  MapEngineMode,
  ScenarioId,
  WeatherFeedSnapshot,
  WeatherProfileId,
} from '../../engine/types';
import { WEATHER_PROFILES } from '../../engine/weatherService';
import { DivisionInspectorDrawer } from './DivisionInspectorDrawer';
import { GoogleBangladeshMap } from './GoogleBangladeshMap';
import { ThreeBangladeshGridMap } from './ThreeBangladeshGridMap';

interface GridMapViewProps {
  controls: GridControls;
  snapshot: GridSnapshot;
  weather: WeatherFeedSnapshot;
  selectedDivisionId: DivisionId | null;
  onSelectDivision: (id: DivisionId | null) => void;
  onSelectScenario: (scenario: Exclude<ScenarioId, 'custom'>) => void;
  onSelectWeatherProfile: (profileId: WeatherProfileId) => void;
  onOpenWeatherFeed: () => void;
  mapsApiKey: string;
  mapEngine: MapEngineMode;
  onChangeMapEngine: (engine: MapEngineMode) => void;
  mapsQuotaExceeded: boolean;
}

const COMPACT_PROFILE_LABELS: Record<WeatherProfileId, string> = {
  seasonal_normal: 'Normal',
  pre_monsoon_warm: 'Warm',
  severe_heatwave: 'Heatwave',
  monsoon_cool: 'Monsoon',
};

export const GridMapView: React.FC<GridMapViewProps> = ({
  controls,
  snapshot,
  weather,
  selectedDivisionId,
  onSelectDivision,
  onSelectScenario,
  onSelectWeatherProfile,
  onOpenWeatherFeed,
  mapsApiKey,
  mapEngine,
  onChangeMapEngine,
  mapsQuotaExceeded,
}) => {
  const [dockExpanded, setDockExpanded] = useState(true);
  const [showThermalOverlay, setShowThermalOverlay] = useState(true);

  const selectedDivision = selectedDivisionId
    ? snapshot.divisions.find((d) => d.id === selectedDivisionId) ?? null
    : null;

  const selectedWeatherReading = selectedDivisionId
    ? weather.readings.find((r) => r.divisionId === selectedDivisionId)
    : undefined;

  // Automatically fall back to interactive 3D Grid Twin if no Google Maps API key is configured
  const canUseGoogleMaps = Boolean(mapsApiKey && mapsApiKey.trim().length > 0 && !mapsQuotaExceeded);
  const activeEngine: MapEngineMode =
    mapEngine === 'google' && canUseGoogleMaps ? 'google' : 'three3d';

  const isHeatwave = weather.forecastParams.heatwaveTriggered;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#EAF0F6]">
      {/* Full-Bleed Unobstructed Map Canvas */}
      {activeEngine === 'google' ? (
        <GoogleBangladeshMap
          apiKey={mapsApiKey}
          divisions={snapshot.divisions}
          corridors={snapshot.corridors}
          weather={weather}
          showThermalOverlay={showThermalOverlay}
          selectedDivisionId={selectedDivisionId}
          onSelectDivision={(id) => onSelectDivision(id)}
        />
      ) : (
        <ThreeBangladeshGridMap
          divisions={snapshot.divisions}
          corridors={snapshot.corridors}
          weather={weather}
          showThermalOverlay={showThermalOverlay}
          selectedDivisionId={selectedDivisionId}
          onSelectDivision={(id) => onSelectDivision(id)}
        />
      )}

      {/* Compact Top-Left Map Engine Switcher + Thermal Heatmap Toggle */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 max-w-[calc(100%-24px)]">
        <div
          role="group"
          aria-label="Map renderer mode"
          className="inline-flex items-center p-1 rounded-lg bg-white border border-slate-200 shadow-sm"
        >
          <button
            type="button"
            onClick={() => onChangeMapEngine('google')}
            disabled={!canUseGoogleMaps}
            title={
              canUseGoogleMaps
                ? 'Switch to Google Maps Platform view'
                : 'Google Maps API key unavailable — using 3D Grid Twin'
            }
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeEngine === 'google'
                ? 'bg-slate-900 text-white'
                : canUseGoogleMaps
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  : 'text-slate-400 cursor-not-allowed'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Google Maps
          </button>
          <button
            type="button"
            onClick={() => onChangeMapEngine('three3d')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeEngine === 'three3d'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            3D Grid Twin
          </button>
        </div>

        {/* Thermal Heatmap Overlay Toggle */}
        <button
          type="button"
          onClick={() => setShowThermalOverlay((v) => !v)}
          aria-pressed={showThermalOverlay}
          data-testid="toggle-thermal-heatmap"
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border shadow-sm text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            showThermalOverlay
              ? isHeatwave
                ? 'bg-rose-700 border-rose-700 text-white hover:bg-rose-800'
                : 'bg-amber-600 border-amber-600 text-white hover:bg-amber-700'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          {isHeatwave && showThermalOverlay ? (
            <Flame className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Thermometer className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>Thermal Heatmap</span>
        </button>

        {selectedDivision && (
          <button
            type="button"
            onClick={() => onSelectDivision(null)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 shadow-sm text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset View
          </button>
        )}
      </div>

      {/* Compact Floating Thermal Legend & Quick Weather Regime Card (Left-aligned, never collides with Inspector Drawer) */}
      {showThermalOverlay && (
        <div
          data-testid="thermal-legend-card"
          className="hidden sm:block absolute top-[62px] left-3 z-20 w-[292px] rounded-xl bg-white border border-slate-200 shadow-sm p-3 space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {isHeatwave ? (
                <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              ) : (
                <Thermometer className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              )}
              <span className="text-[11px] font-bold text-slate-900 truncate">
                Thermal Demand Pressure
              </span>
            </div>
            <span
              data-testid="map-thermal-peak"
              className={`font-mono text-xs font-bold tabular-nums shrink-0 ${
                isHeatwave ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {weather.forecastParams.maxTempC.toFixed(1)}°C
            </span>
          </div>

          {/* Perceptual Temperature Ramp Bar (25°C -> 42°C) with 38°C Trigger Tick */}
          <div className="space-y-1">
            <div className="relative h-2 w-full rounded-full overflow-hidden border border-slate-200/80">
              <div
                className="w-full h-full"
                style={{
                  background:
                    'linear-gradient(90deg, #38BDF8 0%, #2DD4BF 24%, #84CC16 42%, #FACC15 56%, #F97316 74%, #E11D48 86%, #9F1239 100%)',
                }}
              />
              {/* 38.0°C Heatwave Trigger Threshold Marker (~76.5% along 25-42°C scale) */}
              <div
                title="38.0°C Auto-Heatwave Trigger"
                className="absolute top-0 bottom-0 w-0.5 bg-slate-900"
                style={{ left: '76.5%' }}
              />
            </div>
            <div className="flex items-center justify-between font-mono text-[10px] text-slate-500 tabular-nums">
              <span>25°C Cool</span>
              <span>32°C</span>
              <span className="font-bold text-rose-700">38°C+</span>
              <span>42°C</span>
            </div>
          </div>

          {/* 1-Click Weather Regime Switcher right on the Map */}
          <div
            role="group"
            aria-label="Map thermal weather regime"
            className="grid grid-cols-4 gap-1 pt-0.5"
          >
            {WEATHER_PROFILES.map((preset) => {
              const active = weather.profileId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectWeatherProfile(preset.id)}
                  aria-pressed={active}
                  className={`py-1 px-1 rounded text-[10px] font-semibold transition-colors text-center truncate cursor-pointer ${
                    active
                      ? preset.id === 'severe_heatwave'
                        ? 'bg-rose-700 text-white'
                        : 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {COMPACT_PROFILE_LABELS[preset.id]}
                </button>
              );
            })}
          </div>

          {/* Peak Hotspot & Forecast Link */}
          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[10px]">
            <span className="text-slate-500 truncate">
              Peak: <strong className="text-slate-800">{weather.forecastParams.hottestDivisionName}</strong>{' '}
              ({weather.forecastParams.projectedCoolingSurgeMW >= 0 ? '+' : ''}
              {weather.forecastParams.projectedCoolingSurgeMW} MW)
            </span>
            <button
              type="button"
              onClick={onOpenWeatherFeed}
              className="font-semibold text-sky-700 hover:text-sky-900 shrink-0 cursor-pointer"
            >
              API Feed
            </button>
          </div>
        </div>
      )}

      {/* Division Zoom Inspector Slide-Over Drawer (Only visible when a division is selected) */}
      {selectedDivision && (
        <DivisionInspectorDrawer
          division={selectedDivision}
          mode={controls.mode}
          weatherReading={selectedWeatherReading}
          onClose={() => onSelectDivision(null)}
        />
      )}

      {/* Collapsible Bottom Control Dock (Zero Viewport Occlusion, solid white surface — no backdrop-filter over WebGL) */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[min(1080px,calc(100%-24px))] flex flex-col items-center">
        <button
          type="button"
          onClick={() => setDockExpanded((v) => !v)}
          aria-expanded={dockExpanded}
          className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-t-lg bg-white border border-b-0 border-slate-200 text-[11px] font-semibold text-slate-600 hover:text-slate-900 shadow-sm cursor-pointer"
        >
          {dockExpanded ? (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Hide Grid Dock
            </>
          ) : (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Show Scenarios &amp; Divisions
            </>
          )}
        </button>

        {dockExpanded && (
          <div className="pointer-events-auto w-full rounded-xl bg-white border border-slate-200 shadow-md px-3 py-2 flex flex-col xl:flex-row xl:items-center justify-between gap-2">
            {/* Quick 1-Click Scenarios */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 xl:pb-0">
              {SCENARIO_PRESETS.map((preset) => {
                const active = controls.scenario === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelectScenario(preset.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {preset.shortTitle}
                  </button>
                );
              })}
            </div>

            <div className="hidden xl:block h-5 w-px bg-slate-200 shrink-0" />

            {/* 8-Division Quick Zoom Strip */}
            <div className="flex items-center gap-0.5 overflow-x-auto">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1" aria-hidden="true" />
              {snapshot.divisions.map((div) => {
                const active = selectedDivisionId === div.id;
                return (
                  <button
                    key={div.id}
                    type="button"
                    onClick={() => onSelectDivision(active ? null : div.id)}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-sky-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {div.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
