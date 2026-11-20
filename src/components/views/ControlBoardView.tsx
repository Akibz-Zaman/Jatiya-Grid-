import React from 'react';
import {
  Activity,
  ArrowUpRight,
  Cpu,
  Flame,
  Gauge,
  Radiation,
  ShieldAlert,
  Sliders,
  Zap,
} from 'lucide-react';
import { SCENARIO_PRESETS } from '../../engine/bangladeshData';
import {
  DivisionId,
  GridControls,
  GridSnapshot,
  OperatingMode,
  ScenarioId,
  WeatherFeedSnapshot,
} from '../../engine/types';

interface ControlBoardViewProps {
  controls: GridControls;
  snapshot: GridSnapshot;
  weather: WeatherFeedSnapshot;
  onChangeMode: (mode: OperatingMode) => void;
  onSelectScenario: (scenario: Exclude<ScenarioId, 'custom'>) => void;
  onUpdateControls: (patch: Partial<GridControls>) => void;
  onZoomToDivision: (id: DivisionId) => void;
  onOpenWeatherFeed: () => void;
}

export const ControlBoardView: React.FC<ControlBoardViewProps> = ({
  controls,
  snapshot,
  weather,
  onChangeMode,
  onSelectScenario,
  onUpdateControls,
  onZoomToDivision,
  onOpenWeatherFeed,
}) => {
  const nonNuclearTotal =
    controls.gasLngMW + controls.coalMW + controls.solarHydroMW + controls.hvdcImportMW;

  const handleNonNuclearMasterSlider = (newTotal: number) => {
    const currentTotal = Math.max(1, nonNuclearTotal);
    const ratio = newTotal / currentTotal;
    onUpdateControls({
      scenario: 'custom',
      gasLngMW: Math.max(2500, Math.min(9500, Math.round(controls.gasLngMW * ratio))),
      coalMW: Math.max(800, Math.min(4500, Math.round(controls.coalMW * ratio))),
      solarHydroMW: Math.max(200, Math.min(2200, Math.round(controls.solarHydroMW * ratio))),
      hvdcImportMW: Math.max(400, Math.min(2400, Math.round(controls.hvdcImportMW * ratio))),
    });
  };

  return (
    <div className="h-full overflow-y-auto px-5 py-6 lg:px-8">
      <div className="max-w-[1280px] mx-auto space-y-6">
        {/* Page Header & Operating Mode Switch */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="text-xs font-medium text-slate-500">
              National Load Dispatch Console · Bangladesh 400kV / 230kV Grid
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Operator Control Board
            </h1>
          </div>

          {/* Operating Mode Switch */}
          <div
            role="group"
            aria-label="Grid Operating Mode"
            className="inline-flex items-center p-1 rounded-lg bg-white border border-slate-200 shadow-xs self-start md:self-auto"
          >
            <button
              type="button"
              onClick={() => onChangeMode('autonomous')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                controls.mode === 'autonomous'
                  ? 'bg-emerald-700 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Autonomous AI Mode
            </button>
            <button
              type="button"
              onClick={() => onChangeMode('manual')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                controls.mode === 'manual'
                  ? 'bg-rose-700 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Manual Override Mode
            </button>
          </div>
        </div>

        {/* Mode Behavior Explanation Strip */}
        <div
          className={`rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            controls.mode === 'autonomous'
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : 'bg-rose-50/80 border-rose-200 text-rose-950'
          }`}
        >
          <div className="text-xs leading-relaxed">
            <span className="font-bold">
              {controls.mode === 'autonomous'
                ? 'Closed-Loop Zero-Delay Autonomous Balancing Active: '
                : 'Manual Override Active (Legacy NLDC Simulation): '}
            </span>
            {controls.mode === 'autonomous'
              ? '4 AI agents dynamically optimize Rooppur nuclear & merit-order baseload, hold frequency inside 49.80–50.20 Hz, lock Hospitals at 100%, and cap rural cuts to fair 15-minute rotations.'
              : 'Simulates 30-minute manual SCADA dispatch lag, higher diesel/HFO peaker burn, wider frequency droop, and unequal rural BREB blackouts across northern & southern divisions.'}
          </div>
          <div className="font-mono text-xs font-semibold tabular-nums whitespace-nowrap shrink-0">
            Equity Index: {snapshot.financials.equityIndexScore.toFixed(1)} / 100
          </div>
        </div>

        {/* 1-Click Scenario Stress Tests */}
        <section aria-labelledby="scenarios-heading" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="scenarios-heading" className="text-sm font-bold text-slate-900">
              01. Scenario Stress Tests
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>
                BMD Peak:{' '}
                <strong
                  className={`font-mono tabular-nums ${
                    weather.forecastParams.heatwaveTriggered ? 'text-rose-700' : 'text-slate-800'
                  }`}
                >
                  {weather.forecastParams.maxTempC.toFixed(1)}°C
                </strong>{' '}
                ({weather.forecastParams.hottestDivisionName})
              </span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={onOpenWeatherFeed}
                className="font-semibold text-sky-700 hover:text-sky-900 underline underline-offset-2 cursor-pointer"
              >
                Weather API Feed
              </button>
            </div>
          </div>

          {weather.autoTriggeredHeatwave && controls.scenario === 'heatwave' && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-950">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Auto-Triggered by BMD Weather API:</strong>{' '}
                  {weather.forecastParams.hottestDivisionName} reached{' '}
                  <span className="font-mono font-bold">
                    {weather.forecastParams.maxTempC.toFixed(1)}°C
                  </span>{' '}
                  (&gt; 38.0°C threshold), updating Demand Forecast cooling load (+
                  {weather.forecastParams.projectedCoolingSurgeMW.toLocaleString()} MW).
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenWeatherFeed}
                className="font-semibold text-amber-950 underline underline-offset-2 whitespace-nowrap self-start sm:self-auto cursor-pointer"
              >
                Adjust Weather Feed
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {SCENARIO_PRESETS.map((preset) => {
              const active = controls.scenario === preset.id;
              const Icon =
                preset.id === 'balanced'
                  ? Activity
                  : preset.id === 'heatwave'
                    ? Flame
                    : preset.id === 'rooppur_ramp'
                      ? Radiation
                      : ShieldAlert;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectScenario(preset.id)}
                  className={`text-left rounded-xl p-4 border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
                    active
                      ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        active ? 'text-sky-300' : 'text-slate-600'
                      }`}
                    />
                    <span
                      className={`font-mono text-[11px] font-semibold tabular-nums ${
                        active ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {preset.controls.nationalDemandMW.toLocaleString()} MW
                    </span>
                  </div>
                  <div className="mt-2.5 text-sm font-bold leading-snug">{preset.title}</div>
                  <p
                    className={`mt-1 text-xs leading-relaxed ${
                      active ? 'text-slate-300' : 'text-slate-600'
                    }`}
                  >
                    {preset.subtitle}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Interactive Dispatch Sliders & Generation Mix */}
        <section
          aria-labelledby="dispatch-controls-heading"
          className="rounded-xl bg-white border border-slate-200 p-5 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-slate-700" />
              <h2 id="dispatch-controls-heading" className="text-sm font-bold text-slate-900">
                02. Real-Time Generation &amp; Demand Dispatch Controls
              </h2>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 font-mono tabular-nums">
              <span>Supply: {snapshot.totalSupplyMW.toLocaleString()} MW</span>
              <span aria-hidden="true">·</span>
              <span>Peakers: {snapshot.peakerDispatchMW.toLocaleString()} MW</span>
            </div>
          </div>

          {/* Primary 4 Master Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {/* National Demand */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="slider-demand" className="text-xs font-semibold text-slate-800">
                  National Demand (MW)
                </label>
                <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                  {controls.nationalDemandMW.toLocaleString()} MW
                </span>
              </div>
              <input
                id="slider-demand"
                type="range"
                min={10000}
                max={19500}
                step={100}
                value={controls.nationalDemandMW}
                onChange={(e) =>
                  onUpdateControls({
                    scenario: 'custom',
                    nationalDemandMW: Number(e.target.value),
                  })
                }
                className="w-full grid-slider"
              />
              <div className="flex justify-between font-mono text-[11px] text-slate-400 tabular-nums">
                <span>10,000 MW</span>
                <span>Peak Summer 17,000+ MW</span>
                <span>19,500 MW</span>
              </div>
            </div>

            {/* Rooppur Nuclear Baseload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="slider-rooppur" className="text-xs font-semibold text-slate-800">
                  Rooppur Nuclear Baseload (MW)
                </label>
                <span className="font-mono text-sm font-bold text-sky-700 tabular-nums">
                  {controls.rooppurNuclearMW.toLocaleString()} MW
                </span>
              </div>
              <input
                id="slider-rooppur"
                type="range"
                min={350}
                max={2400}
                step={50}
                value={controls.rooppurNuclearMW}
                onChange={(e) =>
                  onUpdateControls({
                    scenario: 'custom',
                    rooppurNuclearMW: Number(e.target.value),
                  })
                }
                className="w-full grid-slider"
              />
              <div className="flex justify-between font-mono text-[11px] text-slate-400 tabular-nums">
                <span>350 MW (Min Sync)</span>
                <span>Unit 1 (1,200 MW)</span>
                <span>2,400 MW (Dual Unit)</span>
              </div>
            </div>

            {/* Gas / Coal / Solar / HVDC Dispatch Master */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="slider-non-nuclear" className="text-xs font-semibold text-slate-800">
                  Gas / Coal / Solar / HVDC Dispatch (MW)
                </label>
                <span className="font-mono text-sm font-bold text-emerald-700 tabular-nums">
                  {nonNuclearTotal.toLocaleString()} MW
                </span>
              </div>
              <input
                id="slider-non-nuclear"
                type="range"
                min={7000}
                max={16500}
                step={100}
                value={Math.min(16500, Math.max(7000, nonNuclearTotal))}
                onChange={(e) => handleNonNuclearMasterSlider(Number(e.target.value))}
                className="w-full grid-slider"
              />
              <div className="flex justify-between font-mono text-[11px] text-slate-400 tabular-nums">
                <span>7,000 MW</span>
                <span>Merit-Order Fleet</span>
                <span>16,500 MW</span>
              </div>
            </div>

            {/* Feeder Shedding Cap */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="slider-shed-cap" className="text-xs font-semibold text-slate-800">
                  Feeder Shedding Cap (%)
                </label>
                <span className="font-mono text-sm font-bold text-amber-700 tabular-nums">
                  {controls.feederSheddingCapPct}%
                </span>
              </div>
              <input
                id="slider-shed-cap"
                type="range"
                min={0}
                max={35}
                step={1}
                value={controls.feederSheddingCapPct}
                onChange={(e) =>
                  onUpdateControls({
                    scenario: 'custom',
                    feederSheddingCapPct: Number(e.target.value),
                  })
                }
                className="w-full grid-slider"
              />
              <div className="flex justify-between font-mono text-[11px] text-slate-400 tabular-nums">
                <span>0% (No Shed)</span>
                <span>Equitable Rotating Ceiling</span>
                <span>35%</span>
              </div>
            </div>
          </div>

          {/* Granular Source Breakdown Sliders */}
          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="slider-gas" className="text-slate-600 font-medium">
                  Gas &amp; LNG CCGT
                </label>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {controls.gasLngMW.toLocaleString()} MW
                </span>
              </div>
              <input
                id="slider-gas"
                type="range"
                min={2500}
                max={9500}
                step={100}
                value={controls.gasLngMW}
                onChange={(e) =>
                  onUpdateControls({ scenario: 'custom', gasLngMW: Number(e.target.value) })
                }
                className="w-full grid-slider"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="slider-coal" className="text-slate-600 font-medium">
                  Ultra-Supercritical Coal
                </label>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {controls.coalMW.toLocaleString()} MW
                </span>
              </div>
              <input
                id="slider-coal"
                type="range"
                min={800}
                max={4500}
                step={50}
                value={controls.coalMW}
                onChange={(e) =>
                  onUpdateControls({ scenario: 'custom', coalMW: Number(e.target.value) })
                }
                className="w-full grid-slider"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="slider-solar" className="text-slate-600 font-medium">
                  Solar &amp; Kaptai Hydro
                </label>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {controls.solarHydroMW.toLocaleString()} MW
                </span>
              </div>
              <input
                id="slider-solar"
                type="range"
                min={200}
                max={2200}
                step={50}
                value={controls.solarHydroMW}
                onChange={(e) =>
                  onUpdateControls({ scenario: 'custom', solarHydroMW: Number(e.target.value) })
                }
                className="w-full grid-slider"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="slider-hvdc" className="text-slate-600 font-medium">
                  Bheramara HVDC Import
                </label>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {controls.hvdcImportMW.toLocaleString()} MW
                </span>
              </div>
              <input
                id="slider-hvdc"
                type="range"
                min={400}
                max={2400}
                step={50}
                value={controls.hvdcImportMW}
                onChange={(e) =>
                  onUpdateControls({ scenario: 'custom', hvdcImportMW: Number(e.target.value) })
                }
                className="w-full grid-slider"
              />
            </div>
          </div>
        </section>

        {/* 8-Division Live Allocation Table */}
        <section
          aria-labelledby="divisions-table-heading"
          className="rounded-xl bg-white border border-slate-200 overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-slate-700" />
              <h2 id="divisions-table-heading" className="text-sm font-bold text-slate-900">
                03. Eight-Division Live Allocation Matrix
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              Click any division to jump to and zoom into its substation on the Grid Map
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Division &amp; Grid Hub</th>
                  <th className="py-3 px-4 text-right">Demand (MW)</th>
                  <th className="py-3 px-4 text-right">Allocated (MW)</th>
                  <th className="py-3 px-4 text-right">Supply % (Delta)</th>
                  <th className="py-3 px-4 text-right">Hospitals</th>
                  <th className="py-3 px-4 text-right">Rural BREB</th>
                  <th className="py-3 px-4 text-right">Map Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {snapshot.divisions.map((div) => {
                  const hospitals = div.subZones.find((z) => z.category === 'hospitals')!;
                  const rural = div.subZones.find((z) => z.category === 'rural')!;
                  const sign = div.deltaPct > 0 ? '+' : '';
                  const statusTextClass =
                    div.status === 'critical'
                      ? 'text-rose-700'
                      : div.status === 'shedding'
                        ? 'text-amber-700'
                        : div.status === 'elevated'
                          ? 'text-sky-700'
                          : 'text-emerald-700';

                  return (
                    <tr
                      key={div.id}
                      onClick={() => onZoomToDivision(div.id)}
                      className="hover:bg-slate-50/90 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{div.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {div.hubName} · {div.voltageKv} kV
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                        {div.demandMW.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {div.allocatedMW.toLocaleString()}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-bold tabular-nums ${statusTextClass}`}>
                        {div.supplyPct.toFixed(1)}% ({sign}
                        {div.deltaPct.toFixed(1)}%)
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <span
                          className={
                            hospitals.supplyPct >= 99.5
                              ? 'font-semibold text-emerald-700'
                              : 'font-semibold text-rose-700'
                          }
                        >
                          {hospitals.supplyPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <span
                          className={
                            rural.supplyPct < 70
                              ? 'font-semibold text-rose-700'
                              : rural.supplyPct < 95
                                ? 'font-semibold text-amber-700'
                                : 'font-semibold text-slate-700'
                          }
                        >
                          {rural.supplyPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onZoomToDivision(div.id);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:border-slate-900 hover:text-slate-900 transition-colors whitespace-nowrap"
                        >
                          Zoom to Area
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Frequency & Reserve Footer Summary */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 pt-1">
          <div className="inline-flex items-center gap-2">
            <Gauge className="w-3.5 h-3.5 text-slate-400" />
            <span>
              National Synchronous Bus: <strong className="font-mono text-slate-800">{snapshot.frequencyHz.toFixed(2)} Hz</strong> ({snapshot.frequencyStatus})
            </span>
          </div>
          <div className="font-mono tabular-nums">
            Reserve Margin: {snapshot.reserveMarginMW >= 0 ? '+' : ''}
            {snapshot.reserveMarginMW.toLocaleString()} MW
          </div>
        </div>
      </div>
    </div>
  );
};
