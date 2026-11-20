import React from 'react';
import {
  CloudRain,
  CloudSun,
  Flame,
  RefreshCw,
  Sun,
  Thermometer,
  Zap,
} from 'lucide-react';
import { WeatherFeedSnapshot, WeatherProfileId } from '../../engine/types';
import { WEATHER_PROFILES } from '../../engine/weatherService';

interface WeatherTelemetryPanelProps {
  weather: WeatherFeedSnapshot;
  isPolling: boolean;
  onSelectProfile: (profileId: WeatherProfileId) => void;
  onChangeTempOffset: (offsetC: number) => void;
  onToggleAutoSync: () => void;
  onPollNow: () => void;
}

export const WeatherTelemetryPanel: React.FC<WeatherTelemetryPanelProps> = ({
  weather,
  isPolling,
  onSelectProfile,
  onChangeTempOffset,
  onToggleAutoSync,
  onPollNow,
}) => {
  const { forecastParams } = weather;
  const isHeatwave = forecastParams.heatwaveTriggered;
  const surgeSign = forecastParams.projectedCoolingSurgeMW > 0 ? '+' : '';

  return (
    <section
      aria-labelledby="weather-feed-heading"
      className={`rounded-xl bg-white border transition-colors overflow-hidden ${
        isHeatwave ? 'border-rose-300' : 'border-slate-200'
      }`}
    >
      {/* Top Header & API Controls */}
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Thermometer
              className={`w-4 h-4 shrink-0 ${isHeatwave ? 'text-rose-600' : 'text-sky-600'}`}
            />
            <h2 id="weather-feed-heading" className="text-sm font-bold text-slate-900">
              01. BMD Mock Weather API → Demand Forecast Parameters
            </h2>
            <span className="font-mono text-[11px] text-slate-400 hidden sm:inline">
              GET {weather.endpointUrl}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Streams 8-division surface temperatures into Agent 01. Automatically activates the{' '}
            <strong className="text-slate-700">Peak Summer Heatwave</strong> scenario when any
            region exceeds <strong className="font-mono text-slate-700">38.0°C</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleAutoSync}
            aria-pressed={weather.autoSyncEnabled}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              weather.autoSyncEnabled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Auto-Trigger &gt;38°C: {weather.autoSyncEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={onPollNow}
            disabled={isPolling}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin' : ''}`} />
            <span>{isPolling ? 'Polling API...' : 'Poll Weather API'}</span>
          </button>
        </div>
      </div>

      {/* Weather Regime Presets + Fine Temperature Shift Slider */}
      <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div
          role="group"
          aria-label="Mock weather regime presets"
          className="flex flex-wrap items-center gap-2"
        >
          {WEATHER_PROFILES.map((preset) => {
            const active = weather.profileId === preset.id;
            const Icon =
              preset.id === 'severe_heatwave'
                ? Flame
                : preset.id === 'monsoon_cool'
                  ? CloudRain
                  : preset.id === 'pre_monsoon_warm'
                    ? Sun
                    : CloudSun;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectProfile(preset.id)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? preset.id === 'severe_heatwave'
                      ? 'bg-rose-700 border-rose-700 text-white'
                      : 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{preset.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Fine Regional Temperature Offset Slider */}
        <div className="flex items-center gap-3 min-w-[260px] xl:w-[360px]">
          <label
            htmlFor="weather-temp-offset"
            className="text-xs font-semibold text-slate-700 whitespace-nowrap"
          >
            Temp Shift
          </label>
          <input
            id="weather-temp-offset"
            type="range"
            min={-4}
            max={10}
            step={0.5}
            value={weather.tempOffsetC}
            onChange={(e) => onChangeTempOffset(Number(e.target.value))}
            className="flex-1 grid-slider"
          />
          <span className="font-mono text-xs font-bold text-slate-900 tabular-nums w-14 text-right">
            {weather.tempOffsetC > 0 ? `+${weather.tempOffsetC.toFixed(1)}` : weather.tempOffsetC.toFixed(1)}°C
          </span>
        </div>
      </div>

      {/* Injected Demand Forecast Agent Parameter Readout */}
      <div className="px-5 py-3.5 border-b border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        <div className="sm:pr-4">
          <div className="text-[11px] text-slate-500">Peak Regional Temperature</div>
          <div
            data-testid="weather-peak-temp"
            className={`mt-0.5 font-mono text-lg font-bold tabular-nums ${
              isHeatwave ? 'text-rose-700' : 'text-slate-900'
            }`}
          >
            {forecastParams.maxTempC.toFixed(1)}°C
          </div>
          <div className="text-[11px] text-slate-500">
            {forecastParams.hottestDivisionName} · Avg {forecastParams.nationalAvgTempC.toFixed(1)}°C
          </div>
        </div>

        <div className="pt-2 sm:pt-0 sm:px-4">
          <div className="text-[11px] text-slate-500">38.0°C Heatwave Trigger</div>
          <div
            data-testid="weather-trigger-status"
            className={`mt-0.5 text-sm font-bold leading-7 ${
              weather.autoTriggeredHeatwave
                ? 'text-rose-700'
                : isHeatwave
                  ? 'text-amber-700'
                  : 'text-emerald-700'
            }`}
          >
            {weather.autoTriggeredHeatwave
              ? 'Heatwave Auto-Triggered'
              : isHeatwave
                ? 'Threshold Breached (Sync Off)'
                : 'Standby (Below 38.0°C)'}
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums">
            Updated {weather.fetchedAtBST} · {weather.latencyMs} ms
          </div>
        </div>

        <div className="pt-2 sm:pt-0 sm:px-4">
          <div className="text-[11px] text-slate-500">Forecast Cooling Surge</div>
          <div
            data-testid="weather-cooling-surge"
            className={`mt-0.5 font-mono text-lg font-bold tabular-nums ${
              forecastParams.projectedCoolingSurgeMW > 0
                ? 'text-amber-700'
                : forecastParams.projectedCoolingSurgeMW < 0
                  ? 'text-sky-700'
                  : 'text-slate-900'
            }`}
          >
            {surgeSign}
            {forecastParams.projectedCoolingSurgeMW.toLocaleString()} MW
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums">
            Elasticity {forecastParams.coolingElasticityMwPerC} MW/°C · {forecastParams.avgHumidityPct}% RH
          </div>
        </div>

        <div className="pt-2 sm:pt-0 sm:pl-4">
          <div className="text-[11px] text-slate-500">Agent 01 Forecast Target</div>
          <div className="mt-0.5 font-mono text-lg font-bold text-slate-900 tabular-nums">
            {forecastParams.recommendedDemandMW.toLocaleString()} MW
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums">
            15-min ramp: +{forecastParams.horizon15MinRampMW} MW
          </div>
        </div>
      </div>

      {/* 8-Division Live Weather Strip */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 bg-slate-50/40">
        {weather.readings.map((r) => {
          const deltaSign = r.coolingLoadDeltaMW > 0 ? '+' : '';
          return (
            <div
              key={r.divisionId}
              className={`rounded-lg border px-3 py-2.5 transition-colors ${
                r.heatwaveAlert
                  ? 'bg-rose-50/80 border-rose-200'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-slate-800 truncate">
                  {r.divisionName}
                </span>
                {r.heatwaveAlert && (
                  <Flame className="w-3 h-3 text-rose-600 shrink-0" aria-label="Exceeds 38°C" />
                )}
              </div>
              <div
                className={`mt-1 font-mono text-base font-bold tabular-nums ${
                  r.heatwaveAlert ? 'text-rose-700' : 'text-slate-900'
                }`}
              >
                {r.temperatureC.toFixed(1)}°C
              </div>
              <div className="mt-0.5 flex items-center justify-between font-mono text-[10px] text-slate-500 tabular-nums">
                <span>RH {r.humidityPct}%</span>
                <span
                  className={
                    r.coolingLoadDeltaMW > 0
                      ? 'text-amber-700 font-semibold'
                      : r.coolingLoadDeltaMW < 0
                        ? 'text-sky-700 font-semibold'
                        : 'text-slate-400'
                  }
                >
                  {deltaSign}
                  {r.coolingLoadDeltaMW} MW
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
