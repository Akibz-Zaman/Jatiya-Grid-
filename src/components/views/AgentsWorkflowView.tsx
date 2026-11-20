import React from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Pause,
  Play,
  RefreshCw,
  Scale,
  ShieldCheck,
  StepForward,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import {
  AgentPipelineState,
  GridControls,
  GridSnapshot,
  WeatherFeedSnapshot,
  WeatherProfileId,
} from '../../engine/types';
import { WeatherTelemetryPanel } from './WeatherTelemetryPanel';

interface AgentsWorkflowViewProps {
  controls: GridControls;
  snapshot: GridSnapshot;
  pipeline: AgentPipelineState;
  weather: WeatherFeedSnapshot;
  isPollingWeather: boolean;
  onStepNow: () => void;
  onToggleAutoRun: () => void;
  onSelectWeatherProfile: (profileId: WeatherProfileId) => void;
  onChangeWeatherTempOffset: (offsetC: number) => void;
  onToggleWeatherAutoSync: () => void;
  onPollWeatherNow: () => void;
}

const AGENT_ICONS = {
  forecast: Activity,
  dispatch: Zap,
  shedding: Scale,
  guardrail: ShieldCheck,
};

export const AgentsWorkflowView: React.FC<AgentsWorkflowViewProps> = ({
  controls,
  snapshot,
  pipeline,
  weather,
  isPollingWeather,
  onStepNow,
  onToggleAutoRun,
  onSelectWeatherProfile,
  onChangeWeatherTempOffset,
  onToggleWeatherAutoSync,
  onPollWeatherNow,
}) => {
  const isManual = controls.mode === 'manual';

  return (
    <div className="h-full overflow-y-auto px-5 py-6 lg:px-8">
      <div className="max-w-[1280px] mx-auto space-y-6">
        {/* Header + Controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Closed-Loop Multi-Agent Orchestration</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">Cycle #{pipeline.cycleCount}</span>
              <span aria-hidden="true">·</span>
              <span>{isManual ? 'Advisory Standby (Manual Override)' : 'Autonomous Actuation Active'}</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              AI Agents Workflow
            </h1>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <button
              type="button"
              onClick={onToggleAutoRun}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              {pipeline.autoRun ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  Pause Loop
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  Resume Loop
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onStepNow}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <StepForward className="w-3.5 h-3.5" />
              Step Cycle Now
            </button>
          </div>
        </div>

        {/* BMD Mock Weather API → Demand Forecast Parameters */}
        <WeatherTelemetryPanel
          weather={weather}
          isPolling={isPollingWeather}
          onSelectProfile={onSelectWeatherProfile}
          onChangeTempOffset={onChangeWeatherTempOffset}
          onToggleAutoSync={onToggleWeatherAutoSync}
          onPollNow={onPollWeatherNow}
        />

        {/* Closed-Loop Pipeline Diagram (4 Sequential Agents) */}
        <section aria-labelledby="pipeline-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="pipeline-heading" className="text-sm font-bold text-slate-900">
              02. Continuous 4-Agent Control Pipeline
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono tabular-nums">
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  pipeline.autoRun && !isManual ? 'text-sky-600 animate-spin' : 'text-slate-400'
                }`}
                style={{ animationDuration: '4s' }}
              />
              <span>
                {isManual
                  ? 'Bypassed by Operator'
                  : pipeline.autoRun
                    ? 'Closed-loop cycling every 2.8s'
                    : 'Manual step mode'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {pipeline.agents.map((agent, idx) => {
              const Icon = AGENT_ICONS[agent.id];
              const isActive = agent.status === 'active';
              const isBypassed = agent.status === 'bypassed';

              const cardStyle = isActive
                ? 'bg-white border-sky-500 ring-2 ring-sky-500/15 shadow-sm'
                : isBypassed
                  ? 'bg-slate-50/90 border-slate-200'
                  : 'bg-white border-slate-200';

              const statusLabel = isActive
                ? 'Running'
                : isBypassed
                  ? 'Bypassed'
                  : 'Verified';

              const statusColor = isActive
                ? 'text-sky-700'
                : isBypassed
                  ? 'text-amber-700'
                  : 'text-emerald-700';

              return (
                <div
                  key={agent.id}
                  className={`relative rounded-xl border p-4 flex flex-col justify-between transition-all ${cardStyle}`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isActive
                              ? 'bg-sky-600 text-white'
                              : isBypassed
                                ? 'bg-slate-200 text-slate-600'
                                : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="font-mono text-xs font-semibold text-slate-400">
                          0{agent.stepNumber}
                        </span>
                      </div>

                      <div className={`inline-flex items-center gap-1 text-xs font-semibold ${statusColor}`}>
                        {isActive ? (
                          <Cpu className="w-3.5 h-3.5" />
                        ) : isBypassed ? (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>{statusLabel}</span>
                      </div>
                    </div>

                    <h3 className="mt-3 text-sm font-bold text-slate-900 leading-snug">
                      {agent.name}
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                      {agent.role}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] text-slate-500">{agent.primaryMetricLabel}</span>
                      <span className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                        {agent.primaryMetricValue}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      {agent.lastAction}
                    </p>
                    {!isBypassed && (
                      <div className="font-mono text-[10px] text-slate-400 tabular-nums">
                        Compute latency: {agent.latencyMs} ms
                      </div>
                    )}
                  </div>

                  {/* Subtle flow connector arrow on desktop between steps */}
                  {idx < 3 && (
                    <div
                      aria-hidden="true"
                      className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white border border-slate-200 items-center justify-center text-slate-400"
                    >
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Guardrail Telemetry Summary Row */}
        <section className="rounded-xl bg-white border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          <div className="pt-1 sm:pt-0 sm:pr-4">
            <div className="text-[11px] text-slate-500">Frequency Envelope</div>
            <div className="mt-0.5 font-mono text-lg font-bold text-slate-900 tabular-nums">
              {snapshot.frequencyHz.toFixed(2)} Hz
            </div>
            <div className="text-[11px] text-slate-500">Target: 49.80 – 50.20 Hz</div>
          </div>
          <div className="pt-3 sm:pt-0 sm:px-4">
            <div className="text-[11px] text-slate-500">Hospitals &amp; Emergency Lock</div>
            <div className="mt-0.5 font-mono text-lg font-bold text-emerald-700 tabular-nums">
              {controls.mode === 'autonomous'
                ? '100.0%'
                : `${snapshot.financials.comparison.manualHospitalsPct.toFixed(1)}%`}
            </div>
            <div className="text-[11px] text-slate-500">85 priority medical feeders</div>
          </div>
          <div className="pt-3 sm:pt-0 sm:px-4">
            <div className="text-[11px] text-slate-500">Rural BREB Average Supply</div>
            <div className="mt-0.5 font-mono text-lg font-bold text-slate-900 tabular-nums">
              {controls.mode === 'autonomous'
                ? `${snapshot.financials.comparison.autonomousRuralAvgPct.toFixed(1)}%`
                : `${snapshot.financials.comparison.manualRuralAvgPct.toFixed(1)}%`}
            </div>
            <div className="text-[11px] text-slate-500">
              {controls.mode === 'autonomous' ? '15-min rotating micro-cuts' : '3–6h legacy manual cuts'}
            </div>
          </div>
          <div className="pt-3 sm:pt-0 sm:pl-4">
            <div className="text-[11px] text-slate-500">Completed Cycles</div>
            <div className="mt-0.5 font-mono text-lg font-bold text-sky-700 tabular-nums" data-testid="agent-cycle-count">
              #{pipeline.cycleCount}
            </div>
            <div className="text-[11px] text-slate-500">Zero-delay actuation log</div>
          </div>
        </section>

        {/* Live Timestamped Execution Feed */}
        <section
          aria-labelledby="execution-log-heading"
          className="rounded-xl bg-white border border-slate-200 overflow-hidden"
        >
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 id="execution-log-heading" className="text-sm font-bold text-slate-900">
              03. Live Agent Execution Feed (BST)
            </h2>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {pipeline.logs.length} events recorded
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
            {pipeline.logs.map((entry) => {
              const severityClass =
                entry.severity === 'warning'
                  ? 'text-rose-700'
                  : entry.severity === 'guardrail'
                    ? 'text-emerald-700'
                    : entry.severity === 'action'
                      ? 'text-sky-700'
                      : 'text-slate-600';

              return (
                <div
                  key={entry.id}
                  className="px-5 py-3 flex flex-col sm:flex-row sm:items-baseline gap-1.5 sm:gap-4 text-xs hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                    <span className="text-slate-400">{entry.timestampBST}</span>
                    <span className="text-slate-500">C{String(entry.cycle).padStart(3, '0')}</span>
                  </div>
                  <div className={`font-semibold shrink-0 sm:w-48 ${severityClass}`}>
                    {entry.agentName}
                  </div>
                  <div className="text-slate-700 leading-relaxed flex-1">{entry.message}</div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
