import React from 'react';
import { Cpu, Flame, Menu, ShieldAlert, Thermometer } from 'lucide-react';
import { GridSnapshot, OperatingMode, WeatherFeedSnapshot } from '../../engine/types';

interface TopTelemetryBarProps {
  mode: OperatingMode;
  snapshot: GridSnapshot;
  weather: WeatherFeedSnapshot;
  onToggleMode: (mode: OperatingMode) => void;
  onOpenMobileMenu: () => void;
  onOpenWeatherFeed: () => void;
}

export const TopTelemetryBar: React.FC<TopTelemetryBarProps> = ({
  mode,
  snapshot,
  weather,
  onToggleMode,
  onOpenMobileMenu,
  onOpenWeatherFeed,
}) => {
  const freqColor =
    snapshot.frequencyStatus === 'Under-Freq Alert' ||
    snapshot.frequencyStatus === 'Over-Freq Alert'
      ? 'text-rose-700'
      : snapshot.frequencyStatus === 'Guardrail Active'
        ? 'text-sky-700'
        : 'text-emerald-700';

  const balanceColor =
    snapshot.balancePct < 88
      ? 'text-rose-700'
      : snapshot.balancePct < 98
        ? 'text-amber-700'
        : 'text-emerald-700';

  const isHeatwaveTemp = weather.forecastParams.heatwaveTriggered;

  return (
    <header className="no-print h-14 bg-white border-b border-slate-200 px-3 sm:px-5 flex items-center justify-between gap-3 shrink-0 z-30">
      {/* Left: Mobile Menu Trigger + Live National Telemetry Strip */}
      <div className="flex items-center gap-3 sm:gap-5 min-w-0 overflow-x-auto">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Frequency */}
        <div className="flex items-baseline gap-1.5 whitespace-nowrap shrink-0">
          <span className="text-[11px] font-medium text-slate-500">Freq</span>
          <span
            data-testid="telemetry-frequency"
            className={`font-mono text-sm font-bold tabular-nums ${freqColor}`}
          >
            {snapshot.frequencyHz.toFixed(2)} Hz
          </span>
          <span className="hidden xl:inline text-[11px] text-slate-400">
            · {snapshot.frequencyStatus}
          </span>
        </div>

        <span className="h-4 w-px bg-slate-200 shrink-0" aria-hidden="true" />

        {/* Total Supply */}
        <div className="flex items-baseline gap-1.5 whitespace-nowrap shrink-0">
          <span className="text-[11px] font-medium text-slate-500">Supply</span>
          <span
            data-testid="telemetry-supply"
            className="font-mono text-sm font-bold text-slate-900 tabular-nums"
          >
            {snapshot.totalSupplyMW.toLocaleString()} MW
          </span>
        </div>

        <span className="hidden sm:inline-block h-4 w-px bg-slate-200 shrink-0" aria-hidden="true" />

        {/* Total Demand */}
        <div className="hidden sm:flex items-baseline gap-1.5 whitespace-nowrap shrink-0">
          <span className="text-[11px] font-medium text-slate-500">Demand</span>
          <span
            data-testid="telemetry-demand"
            className="font-mono text-sm font-bold text-slate-700 tabular-nums"
          >
            {snapshot.totalDemandMW.toLocaleString()} MW
          </span>
        </div>

        <span className="hidden md:inline-block h-4 w-px bg-slate-200 shrink-0" aria-hidden="true" />

        {/* National Balance */}
        <div className="hidden md:flex items-baseline gap-1.5 whitespace-nowrap shrink-0">
          <span className="text-[11px] font-medium text-slate-500">Balance</span>
          <span
            data-testid="telemetry-balance"
            className={`font-mono text-sm font-bold tabular-nums ${balanceColor}`}
          >
            {snapshot.balancePct.toFixed(1)}%
          </span>
        </div>

        <span className="hidden lg:inline-block h-4 w-px bg-slate-200 shrink-0" aria-hidden="true" />

        {/* Regional Weather Telemetry Button */}
        <button
          type="button"
          onClick={onOpenWeatherFeed}
          title="Open BMD Mock Weather API & Demand Forecast Feed"
          className={`hidden lg:inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            isHeatwaveTemp
              ? 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          {isHeatwaveTemp ? (
            <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          ) : (
            <Thermometer className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          )}
          <span className="text-[11px] font-medium text-slate-500">Peak</span>
          <span
            data-testid="telemetry-peak-temp"
            className={`font-mono text-xs font-bold tabular-nums ${
              isHeatwaveTemp ? 'text-rose-700' : 'text-slate-900'
            }`}
          >
            {weather.forecastParams.maxTempC.toFixed(1)}°C
          </span>
          {weather.autoTriggeredHeatwave && (
            <span className="hidden xl:inline text-[11px] font-semibold text-rose-700">
              · Heatwave
            </span>
          )}
        </button>
      </div>

      {/* Right: Quick Autonomous / Manual Override Segmented Toggle */}
      <div
        role="group"
        aria-label="Quick operating mode switch"
        className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200 shrink-0"
      >
        <button
          type="button"
          onClick={() => onToggleMode('autonomous')}
          aria-pressed={mode === 'autonomous'}
          className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            mode === 'autonomous'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Cpu className="w-3.5 h-3.5 shrink-0" />
          <span>Autonomous</span>
        </button>
        <button
          type="button"
          onClick={() => onToggleMode('manual')}
          aria-pressed={mode === 'manual'}
          className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            mode === 'manual'
              ? 'bg-rose-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Manual Override</span>
          <span className="sm:hidden">Manual</span>
        </button>
      </div>
    </header>
  );
};
