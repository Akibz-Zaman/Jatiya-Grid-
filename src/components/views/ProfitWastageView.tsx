import React from 'react';
import { ArrowDownRight, ArrowUpRight, Fuel, Scale, TrendingUp, Zap } from 'lucide-react';
import { GridControls, GridSnapshot } from '../../engine/types';

interface ProfitWastageViewProps {
  controls: GridControls;
  snapshot: GridSnapshot;
}

export const ProfitWastageView: React.FC<ProfitWastageViewProps> = ({ controls, snapshot }) => {
  const fin = snapshot.financials;
  const cmp = fin.comparison;

  const maxSaved = Math.max(1, cmp.autonomousDailySavedCrore, cmp.manualDailySavedCrore);
  const maxWastage = Math.max(1, cmp.autonomousDailyWastageCrore, cmp.manualDailyWastageCrore);
  const maxPeaker = Math.max(1, cmp.autonomousPeakerMW, cmp.manualPeakerMW);

  // Generation Mix breakdown for merit-order stack bar
  const mixSegments = [
    { label: 'Rooppur Nuclear', mw: controls.rooppurNuclearMW, color: 'bg-sky-600' },
    { label: 'Gas & LNG CCGT', mw: controls.gasLngMW, color: 'bg-emerald-600' },
    { label: 'Supercritical Coal', mw: controls.coalMW, color: 'bg-slate-600' },
    { label: 'Solar & Hydro', mw: controls.solarHydroMW, color: 'bg-teal-500' },
    { label: 'Bheramara HVDC', mw: controls.hvdcImportMW, color: 'bg-indigo-600' },
    { label: 'Diesel/HFO Peakers', mw: snapshot.peakerDispatchMW, color: 'bg-rose-500' },
  ];
  const mixTotal = Math.max(
    1,
    mixSegments.reduce((sum, s) => sum + s.mw, 0),
  );

  return (
    <div className="h-full overflow-y-auto px-5 py-6 lg:px-8">
      <div className="max-w-[1280px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-5 border-b border-slate-200">
          <div>
            <div className="text-xs font-medium text-slate-500">
              Economic Dispatch &amp; Energy Efficiency Telemetry · Bangladeshi Taka (৳ Crore)
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Profit &amp; Wastage Analytics
            </h1>
          </div>
          <div className="text-xs text-slate-600">
            Active Mode:{' '}
            <strong className={controls.mode === 'autonomous' ? 'text-emerald-700' : 'text-rose-700'}>
              {controls.mode === 'autonomous' ? 'Autonomous AI Mode' : 'Manual Override Mode'}
            </strong>
          </div>
        </div>

        {/* 4 Primary Financial & Efficiency KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Daily Profit / Saved */}
          <div className="rounded-xl bg-white border border-slate-200 p-5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Daily Profit / Saved</span>
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
              ৳{fin.dailyProfitSavedCrore.toFixed(2)} Cr
            </div>
            <div className="mt-1 text-xs text-slate-600 font-mono tabular-nums">
              {fin.dailyMwSaved.toLocaleString()} MW saved / day
            </div>
          </div>

          {/* Daily Loss / Wastage */}
          <div className="rounded-xl bg-white border border-slate-200 p-5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Daily Loss / Wastage</span>
              <ArrowDownRight className="w-4 h-4 text-rose-600" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-rose-700 tabular-nums">
              ৳{fin.dailyLossWastageCrore.toFixed(2)} Cr
            </div>
            <div className="mt-1 text-xs text-slate-600 font-mono tabular-nums">
              {fin.dailyMwLost.toLocaleString()} MW unserved / lost
            </div>
          </div>

          {/* Annualized Net Gain / Impact */}
          <div className="rounded-xl bg-white border border-slate-200 p-5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{fin.annualizedNetGainCrore >= 0 ? 'Annualized Net Gain' : 'Annualized Net Loss'}</span>
              <TrendingUp
                className={`w-4 h-4 ${fin.annualizedNetGainCrore >= 0 ? 'text-sky-600' : 'text-rose-600'}`}
              />
            </div>
            <div
              className={`mt-2 font-mono text-2xl font-bold tabular-nums ${
                fin.annualizedNetGainCrore >= 0 ? 'text-slate-900' : 'text-rose-700'
              }`}
            >
              {fin.annualizedNetGainCrore >= 0 ? '+' : '-'}৳
              {Math.abs(fin.annualizedNetGainCrore).toLocaleString()} Cr
            </div>
            <div className="mt-1 text-xs text-slate-600">Projected 365-day BPDB treasury impact</div>
          </div>

          {/* Peaker Fuel Reduction */}
          <div className="rounded-xl bg-white border border-slate-200 p-5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Peaker Fuel Reduction</span>
              <Fuel className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-sky-700 tabular-nums">
              {fin.peakerFuelReductionPct.toFixed(1)}%
            </div>
            <div className="mt-1 text-xs text-slate-600 font-mono tabular-nums">
              Active HFO/Diesel: {fin.peakerDispatchMW.toLocaleString()} MW
            </div>
          </div>
        </div>

        {/* Comparative Benchmarks: Autonomous AI vs Manual NLDC Dispatch */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Financial Comparison Bars */}
          <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-5">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">
                01. Autonomous AI vs. Manual NLDC Financial Performance
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Live counterfactual benchmark under current {snapshot.totalDemandMW.toLocaleString()} MW demand profile
              </p>
            </div>

            {/* Daily Savings Comparison */}
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-800">
                Daily Merit-Order &amp; Loss Savings (৳ Crore/day)
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-emerald-800">Autonomous AI Dispatch</span>
                    <span className="font-mono font-bold text-emerald-700 tabular-nums">
                      ৳{cmp.autonomousDailySavedCrore.toFixed(2)} Cr/day
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                      style={{ width: `${(cmp.autonomousDailySavedCrore / maxSaved) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-600">Legacy Manual NLDC</span>
                    <span className="font-mono font-semibold text-slate-600 tabular-nums">
                      ৳{cmp.manualDailySavedCrore.toFixed(2)} Cr/day
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-400 transition-all duration-300"
                      style={{ width: `${(cmp.manualDailySavedCrore / maxSaved) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Loss / Wastage Comparison */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-800">
                Daily Wastage &amp; Unserved Economic Loss (৳ Crore/day — lower is better)
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-emerald-800">Autonomous AI Dispatch</span>
                    <span className="font-mono font-bold text-emerald-700 tabular-nums">
                      ৳{cmp.autonomousDailyWastageCrore.toFixed(2)} Cr/day
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-sky-600 transition-all duration-300"
                      style={{ width: `${(cmp.autonomousDailyWastageCrore / maxWastage) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-rose-800">Legacy Manual NLDC</span>
                    <span className="font-mono font-bold text-rose-700 tabular-nums">
                      ৳{cmp.manualDailyWastageCrore.toFixed(2)} Cr/day
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-rose-500 transition-all duration-300"
                      style={{ width: `${(cmp.manualDailyWastageCrore / maxWastage) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Peaker Dispatch Comparison */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-800">
                Expensive Diesel / HFO Peaker Generation Required (MW — lower is better)
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700">Autonomous AI Dispatch</span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {cmp.autonomousPeakerMW.toLocaleString()} MW
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                      style={{ width: `${Math.max(3, (cmp.autonomousPeakerMW / maxPeaker) * 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700">Legacy Manual NLDC</span>
                    <span className="font-mono font-bold text-amber-700 tabular-nums">
                      {cmp.manualPeakerMW.toLocaleString()} MW
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all duration-300"
                      style={{ width: `${(cmp.manualPeakerMW / maxPeaker) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Equity, Protection & Merit-Order Mix */}
          <section className="rounded-xl bg-white border border-slate-200 p-5 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    02. Equitable Service &amp; Stability Comparison
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Measuring rural BREB fairness, hospital lock &amp; frequency control
                  </p>
                </div>
                <Scale className="w-4 h-4 text-slate-500" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                      <th className="py-2 pr-3 font-semibold">Operational Indicator</th>
                      <th className="py-2 px-3 text-right font-semibold text-emerald-700">Autonomous AI</th>
                      <th className="py-2 pl-3 text-right font-semibold text-slate-600">Manual NLDC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                    <tr>
                      <td className="py-2.5 pr-3 font-sans font-medium text-slate-700">
                        Hospitals &amp; Emergency Supply
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                        {cmp.autonomousHospitalsPct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 pl-3 text-right text-slate-600">
                        {cmp.manualHospitalsPct.toFixed(1)}%
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-3 font-sans font-medium text-slate-700">
                        Rural BREB Average Supply
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                        {cmp.autonomousRuralAvgPct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 pl-3 text-right text-rose-700 font-semibold">
                        {cmp.manualRuralAvgPct.toFixed(1)}%
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-3 font-sans font-medium text-slate-700">
                        Grid Frequency Stability
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-sky-700">
                        {cmp.autonomousFrequencyHz.toFixed(2)} Hz
                      </td>
                      <td className="py-2.5 pl-3 text-right text-amber-700 font-semibold">
                        {cmp.manualFrequencyHz.toFixed(2)} Hz
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-3 font-sans font-medium text-slate-700">
                        Net Daily Treasury Advantage
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                        +৳{(cmp.autonomousDailySavedCrore - cmp.manualDailySavedCrore).toFixed(2)} Cr
                      </td>
                      <td className="py-2.5 pl-3 text-right text-slate-500">Baseline</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Live Merit-Order Generation Dispatch Stack */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Zap className="w-3.5 h-3.5 text-sky-600" />
                  <span>Live National Generation Merit-Order Mix</span>
                </div>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {mixTotal.toLocaleString()} MW gross
                </span>
              </div>

              <div className="h-4 w-full rounded-md overflow-hidden flex bg-slate-100">
                {mixSegments.map((seg) => (
                  <div
                    key={seg.label}
                    className={`${seg.color} h-full transition-all duration-300`}
                    style={{ width: `${(seg.mw / mixTotal) * 100}%` }}
                    title={`${seg.label}: ${seg.mw.toLocaleString()} MW`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {mixSegments.map((seg) => (
                  <div key={seg.label} className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-xs shrink-0 ${seg.color}`} />
                      <span className="text-slate-600 truncate">{seg.label}</span>
                    </div>
                    <span className="font-mono font-semibold text-slate-800 tabular-nums shrink-0">
                      {seg.mw.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
