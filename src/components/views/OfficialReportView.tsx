import React, { useState } from 'react';
import { Check, Copy, FileText, Printer } from 'lucide-react';
import {
  formatBSTTimestamp,
  generateOfficialReportText,
  getScenarioLabel,
} from '../../engine/gridEngine';
import {
  AgentPipelineState,
  GridControls,
  GridSnapshot,
  WeatherFeedSnapshot,
} from '../../engine/types';

interface OfficialReportViewProps {
  controls: GridControls;
  snapshot: GridSnapshot;
  pipeline: AgentPipelineState;
  weather: WeatherFeedSnapshot;
}

export const OfficialReportView: React.FC<OfficialReportViewProps> = ({
  controls,
  snapshot,
  pipeline,
  weather,
}) => {
  const [copied, setCopied] = useState(false);

  const generatedNow = new Date();
  const bstTimestamp = formatBSTTimestamp(generatedNow);
  const scenarioLabel = getScenarioLabel(controls.scenario);

  const handleCopyReport = async () => {
    const text = generateOfficialReportText(controls, snapshot, pipeline, new Date(), weather);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback copy for sandboxed environments without Clipboard API permission
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2400);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="h-full overflow-y-auto px-5 py-6 lg:px-8">
      <div className="max-w-[1040px] mx-auto space-y-5">
        {/* Toolbar (hidden during print) */}
        <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="text-xs font-medium text-slate-500">
              Auto-Compiled Live Grid Dispatch Record · Bangladesh Standard Time (BST)
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Official Operational Report
            </h1>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleCopyReport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Report Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Report
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Export PDF
            </button>
          </div>
        </div>

        {/* Printable Formal Operational Document */}
        <article className="print-only-container rounded-xl bg-white border border-slate-200 p-6 lg:p-8 space-y-7 shadow-xs">
          {/* Formal Letterhead */}
          <header className="pb-5 border-b-2 border-slate-900 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <FileText className="w-4 h-4 text-slate-700" />
                <span>International AI Builders Congress 2026 · National Grid Telemetry</span>
              </div>
              <h2 className="mt-1.5 text-xl font-extrabold text-slate-900 tracking-tight">
                Bangladesh National Grid Operational Report
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Compiled automatically by JatiyaGrid AI Autonomous Load Management Platform
              </p>
            </div>

            <div className="text-left sm:text-right text-xs space-y-1 font-mono tabular-nums text-slate-700">
              <div>
                <span className="text-slate-400 font-sans">Timestamp: </span>
                <strong className="text-slate-900">{bstTimestamp}</strong>
              </div>
              <div>
                <span className="text-slate-400 font-sans">Mode: </span>
                <strong
                  className={
                    controls.mode === 'autonomous' ? 'text-emerald-700' : 'text-rose-700'
                  }
                >
                  {controls.mode === 'autonomous' ? 'AUTONOMOUS AI' : 'MANUAL OVERRIDE'}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 font-sans">Scenario: </span>
                <span>{scenarioLabel}</span>
              </div>
              <div>
                <span className="text-slate-400 font-sans">Weather Peak: </span>
                <strong
                  className={
                    weather.forecastParams.heatwaveTriggered ? 'text-rose-700' : 'text-slate-900'
                  }
                >
                  {weather.forecastParams.maxTempC.toFixed(1)}°C ({weather.forecastParams.hottestDivisionName})
                </strong>
                {weather.autoTriggeredHeatwave && (
                  <span className="text-rose-700 font-sans font-semibold"> · Auto-Heatwave</span>
                )}
              </div>
            </div>
          </header>

          {/* Section 1: National Telemetry & Financial Summary */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              1. National Grid Balance &amp; Economic Dispatch Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-b border-slate-200 py-4">
              <div>
                <div className="text-[11px] text-slate-500">Bus Frequency</div>
                <div className="mt-0.5 font-mono text-base font-bold text-slate-900 tabular-nums">
                  {snapshot.frequencyHz.toFixed(2)} Hz
                </div>
                <div className="text-[11px] text-slate-600">{snapshot.frequencyStatus}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Supply vs. Demand</div>
                <div className="mt-0.5 font-mono text-base font-bold text-slate-900 tabular-nums">
                  {snapshot.totalSupplyMW.toLocaleString()} / {snapshot.totalDemandMW.toLocaleString()} MW
                </div>
                <div className="text-[11px] text-slate-600">
                  Balance {snapshot.balancePct.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Daily Profit / Saved</div>
                <div className="mt-0.5 font-mono text-base font-bold text-emerald-700 tabular-nums">
                  ৳{snapshot.financials.dailyProfitSavedCrore.toFixed(2)} Cr/day
                </div>
                <div className="text-[11px] text-slate-600 font-mono tabular-nums">
                  {snapshot.financials.dailyMwSaved.toLocaleString()} MW saved
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Daily Loss / Wastage</div>
                <div className="mt-0.5 font-mono text-base font-bold text-rose-700 tabular-nums">
                  ৳{snapshot.financials.dailyLossWastageCrore.toFixed(2)} Cr/day
                </div>
                <div className="text-[11px] text-slate-600 font-mono tabular-nums">
                  {snapshot.financials.dailyMwLost.toLocaleString()} MW lost · Net ৳
                  {snapshot.financials.annualizedNetGainCrore.toLocaleString()} Cr/yr
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Autonomous Agent Pipeline Status */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              2. Multi-Agent Pipeline Verification (Cycle #{pipeline.cycleCount})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Agent</th>
                    <th className="py-2 px-3 font-semibold">Status</th>
                    <th className="py-2 px-3 font-semibold">Key Telemetry</th>
                    <th className="py-2 pl-3 font-semibold">Latest Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pipeline.agents.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2.5 pr-3 font-semibold text-slate-900 whitespace-nowrap">
                        0{a.stepNumber}. {a.shortName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] font-semibold uppercase">
                        <span
                          className={
                            a.status === 'bypassed'
                              ? 'text-amber-700'
                              : a.status === 'active'
                                ? 'text-sky-700'
                                : 'text-emerald-700'
                          }
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {a.primaryMetricLabel}: <strong>{a.primaryMetricValue}</strong>
                      </td>
                      <td className="py-2.5 pl-3 text-slate-600">{a.lastAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3: All 8 Divisions + Sub-Zone Supply Percentages */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              3. Eight-Division &amp; Local Sub-Zone Supply Matrix
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] text-slate-500">
                    <th className="py-2.5 px-3 font-semibold">Division</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Allocated / Demand</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Division %</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Hospitals</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Cities</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Industrial/EPZ</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Rural BREB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                  {snapshot.divisions.map((div) => {
                    const hosp = div.subZones.find((z) => z.category === 'hospitals')!;
                    const city = div.subZones.find((z) => z.category === 'cities')!;
                    const ind = div.subZones.find((z) => z.category === 'industrial')!;
                    const rural = div.subZones.find((z) => z.category === 'rural')!;
                    const sign = div.deltaPct > 0 ? '+' : '';

                    return (
                      <tr key={div.id}>
                        <td className="py-2.5 px-3 font-sans">
                          <div className="font-semibold text-slate-900">{div.name}</div>
                          <div className="text-[10px] text-slate-500">{div.hubName}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700">
                          {div.allocatedMW.toLocaleString()} / {div.demandMW.toLocaleString()} MW
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {div.supplyPct.toFixed(1)}% ({sign}
                          {div.deltaPct.toFixed(1)}%)
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold">
                          {hosp.supplyPct.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700">
                          {city.supplyPct.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700">
                          {ind.supplyPct.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700">
                          {rural.supplyPct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Document Footer */}
          <footer className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>
              JatiyaGrid AI · Simulation &amp; Decision-Support Telemetry for Bangladesh National Grid
            </span>
            <span className="font-mono tabular-nums">
              Rooppur: {controls.rooppurNuclearMW} MW · Peaker Cut: {snapshot.financials.peakerFuelReductionPct.toFixed(1)}%
            </span>
          </footer>
        </article>
      </div>
    </div>
  );
};
