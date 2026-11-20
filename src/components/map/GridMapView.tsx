import React, { useState } from 'react';
import {
  Box,
  ChevronDown,
  ChevronUp,
  Globe,
  MapPin,
  RotateCcw,
} from 'lucide-react';
import { SCENARIO_PRESETS } from '../../engine/bangladeshData';
import {
  DivisionId,
  GridControls,
  GridSnapshot,
  MapEngineMode,
  ScenarioId,
} from '../../engine/types';
import { DivisionInspectorDrawer } from './DivisionInspectorDrawer';
import { GoogleBangladeshMap } from './GoogleBangladeshMap';
import { ThreeBangladeshGridMap } from './ThreeBangladeshGridMap';

interface GridMapViewProps {
  controls: GridControls;
  snapshot: GridSnapshot;
  selectedDivisionId: DivisionId | null;
  onSelectDivision: (id: DivisionId | null) => void;
  onSelectScenario: (scenario: Exclude<ScenarioId, 'custom'>) => void;
  mapsApiKey: string;
  mapEngine: MapEngineMode;
  onChangeMapEngine: (engine: MapEngineMode) => void;
  mapsQuotaExceeded: boolean;
}

export const GridMapView: React.FC<GridMapViewProps> = ({
  controls,
  snapshot,
  selectedDivisionId,
  onSelectDivision,
  onSelectScenario,
  mapsApiKey,
  mapEngine,
  onChangeMapEngine,
  mapsQuotaExceeded,
}) => {
  const [dockExpanded, setDockExpanded] = useState(true);

  const selectedDivision = selectedDivisionId
    ? snapshot.divisions.find((d) => d.id === selectedDivisionId) ?? null
    : null;

  // Automatically fall back to interactive 3D Grid Twin if no Google Maps API key is configured
  const canUseGoogleMaps = Boolean(mapsApiKey && mapsApiKey.trim().length > 0 && !mapsQuotaExceeded);
  const activeEngine: MapEngineMode =
    mapEngine === 'google' && canUseGoogleMaps ? 'google' : 'three3d';

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#EAF0F6]">
      {/* Full-Bleed Unobstructed Map Canvas */}
      {activeEngine === 'google' ? (
        <GoogleBangladeshMap
          apiKey={mapsApiKey}
          divisions={snapshot.divisions}
          corridors={snapshot.corridors}
          selectedDivisionId={selectedDivisionId}
          onSelectDivision={(id) => onSelectDivision(id)}
        />
      ) : (
        <ThreeBangladeshGridMap
          divisions={snapshot.divisions}
          corridors={snapshot.corridors}
          selectedDivisionId={selectedDivisionId}
          onSelectDivision={(id) => onSelectDivision(id)}
        />
      )}

      {/* Compact Top-Left Map Engine Switcher (Google Maps vs Three.js 3D Grid Twin) */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
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
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
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
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeEngine === 'three3d'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            3D Grid Twin
          </button>
        </div>

        {selectedDivision && (
          <button
            type="button"
            onClick={() => onSelectDivision(null)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 shadow-sm text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset View
          </button>
        )}
      </div>

      {/* Division Zoom Inspector Slide-Over Drawer (Only visible when a division is selected) */}
      {selectedDivision && (
        <DivisionInspectorDrawer
          division={selectedDivision}
          mode={controls.mode}
          onClose={() => onSelectDivision(null)}
        />
      )}

      {/* Collapsible Bottom Control Dock (Zero Viewport Occlusion, solid white surface — no backdrop-filter over WebGL) */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[min(1080px,calc(100%-24px))] flex flex-col items-center">
        <button
          type="button"
          onClick={() => setDockExpanded((v) => !v)}
          aria-expanded={dockExpanded}
          className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-t-lg bg-white border border-b-0 border-slate-200 text-[11px] font-semibold text-slate-600 hover:text-slate-900 shadow-sm"
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
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
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
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
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
