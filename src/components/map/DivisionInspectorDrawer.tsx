import React from 'react';
import {
  ArrowLeft,
  Building2,
  Factory,
  Home,
  Hospital,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Flame,
  Thermometer,
  X,
} from 'lucide-react';
import { getThermalStyleForTemperature } from '../../engine/thermalHeatmap';
import { DivisionState, DivisionWeatherReading, OperatingMode } from '../../engine/types';
import { Substation3DPreview } from './Substation3DPreview';

interface DivisionInspectorDrawerProps {
  division: DivisionState;
  mode: OperatingMode;
  weatherReading?: DivisionWeatherReading;
  onClose: () => void;
}

const SUBZONE_META = {
  hospitals: {
    icon: Hospital,
    accent: 'text-emerald-700',
    barBg: 'bg-emerald-600',
  },
  cities: {
    icon: Building2,
    accent: 'text-sky-700',
    barBg: 'bg-sky-600',
  },
  industrial: {
    icon: Factory,
    accent: 'text-indigo-700',
    barBg: 'bg-indigo-600',
  },
  rural: {
    icon: Home,
    accent: 'text-amber-700',
    barBg: 'bg-amber-500',
  },
};

export const DivisionInspectorDrawer: React.FC<DivisionInspectorDrawerProps> = ({
  division,
  mode,
  weatherReading,
  onClose,
}) => {
  const deltaPrefix = division.deltaPct > 0 ? '+' : '';
  const thermalStyle = weatherReading
    ? getThermalStyleForTemperature(weatherReading.temperatureC)
    : null;

  return (
    <aside
      aria-label={`${division.name} Division Local Distribution Inspector`}
      className="absolute top-3 right-3 bottom-20 w-[356px] max-w-[calc(100vw-24px)] z-30 flex flex-col rounded-xl bg-white border border-slate-200 shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-200 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{division.voltageKv} kV Substation Hub</span>
            <span aria-hidden="true">·</span>
            <span>{mode === 'autonomous' ? 'Autonomous AI' : 'Manual Override'}</span>
          </div>
          <h2 className="mt-0.5 text-lg font-bold text-slate-900 truncate">
            {division.name} Division
          </h2>
          <p className="text-xs text-slate-600 truncate">{division.hubName}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close division inspector and return to national view"
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Live 3D Substation Digital Twin */}
        <Substation3DPreview division={division} />

        {/* Regional Power Telemetry Summary Strip */}
        <div className="grid grid-cols-3 gap-2 pt-1 pb-3 border-b border-slate-100">
          <div>
            <div className="text-[11px] text-slate-500">Allocated</div>
            <div className="font-mono text-sm font-bold text-slate-900 tabular-nums">
              {division.allocatedMW.toLocaleString()} MW
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">Demand</div>
            <div className="font-mono text-sm font-bold text-slate-700 tabular-nums">
              {division.demandMW.toLocaleString()} MW
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">Supply Level</div>
            <div
              className={`font-mono text-sm font-bold tabular-nums ${
                division.status === 'critical'
                  ? 'text-rose-600'
                  : division.status === 'shedding'
                    ? 'text-amber-600'
                    : 'text-emerald-600'
              }`}
            >
              {division.supplyPct.toFixed(1)}% ({deltaPrefix}
              {division.deltaPct.toFixed(1)}%)
            </div>
          </div>
        </div>

        {/* Regional Thermal Pressure Strip */}
        {weatherReading && thermalStyle && (
          <div
            className={`rounded-lg border px-3 py-2.5 flex items-center justify-between gap-3 ${
              weatherReading.heatwaveAlert
                ? 'bg-rose-50/80 border-rose-200'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {weatherReading.heatwaveAlert ? (
                <Flame className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <Thermometer className="w-4 h-4 text-sky-600 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-900">
                  {thermalStyle.pressureTier}
                </div>
                <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                  Feels {weatherReading.feelsLikeC.toFixed(1)}°C · RH {weatherReading.humidityPct}%
                </div>
              </div>
            </div>
            <div className="text-right shrink-0 font-mono tabular-nums">
              <div
                className={`text-sm font-bold ${
                  weatherReading.heatwaveAlert ? 'text-rose-700' : 'text-slate-900'
                }`}
              >
                {weatherReading.temperatureC.toFixed(1)}°C
              </div>
              <div
                className={`text-[10px] font-semibold ${
                  weatherReading.coolingLoadDeltaMW > 0
                    ? 'text-amber-700'
                    : weatherReading.coolingLoadDeltaMW < 0
                      ? 'text-sky-700'
                      : 'text-slate-500'
                }`}
              >
                {weatherReading.coolingLoadDeltaMW > 0 ? '+' : ''}
                {weatherReading.coolingLoadDeltaMW} MW cooling
              </div>
            </div>
          </div>
        )}

        {/* Generation Note */}
        <div className="text-xs text-slate-600 leading-relaxed">
          <span className="font-semibold text-slate-800">Primary Infeed: </span>
          {division.generationNote}
        </div>

        {/* Local Sub-Zone Electricity Distribution */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-semibold text-slate-900">
              Local Sub-Zone Distribution
            </h3>
            <span className="text-[11px] text-slate-500">4 Priority Tiers</span>
          </div>

          <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
            {division.subZones.map((sz) => {
              const meta = SUBZONE_META[sz.category];
              const Icon = meta.icon;
              const barColor =
                sz.status === 'blackout'
                  ? 'bg-rose-600'
                  : sz.status === 'rotating'
                    ? 'bg-amber-500'
                    : meta.barBg;

              return (
                <div key={sz.category} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${meta.accent}`} />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {sz.name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {sz.localLabel}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                        {sz.supplyPct.toFixed(1)}%
                      </div>
                      <div className="font-mono text-[10px] text-slate-500 tabular-nums">
                        {sz.allocatedMW} / {sz.demandMW} MW
                      </div>
                    </div>
                  </div>

                  {/* Clean Supply Progress Bar */}
                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                      style={{ width: `${Math.max(4, Math.min(100, sz.supplyPct))}%` }}
                    />
                  </div>

                  {/* Explicit Text Status (Never Color-Only) */}
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{sz.feederCount} feeders</span>
                    {sz.protected && sz.supplyPct >= 99.5 ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                        <ShieldCheck className="w-3 h-3" />
                        Protected 100% ON
                      </span>
                    ) : sz.rotationWindowMinutes > 0 ? (
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          sz.rotationWindowMinutes >= 120 ? 'text-rose-700' : 'text-amber-700'
                        }`}
                      >
                        {sz.rotationWindowMinutes >= 120 ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {sz.rotationWindowMinutes >= 120
                          ? `Legacy ${Math.round(sz.rotationWindowMinutes / 60)}h Blackout`
                          : `${sz.rotationWindowMinutes}-min Rotating Cut`}
                      </span>
                    ) : (
                      <span className="font-medium text-slate-600">Energized Nominal</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Return Action */}
      <div className="p-3 border-t border-slate-200 bg-slate-50">
        <button
          type="button"
          onClick={onClose}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors whitespace-nowrap"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Return to National Bangladesh Grid
        </button>
      </div>
    </aside>
  );
};
