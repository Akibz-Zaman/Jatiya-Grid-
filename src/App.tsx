import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CONTROLS, SCENARIO_PRESETS } from './engine/bangladeshData';
import {
  buildAgentNodes,
  computeGridSnapshot,
  createInitialAgentPipeline,
  formatBSTTimeShort,
  stepAgentCycle,
} from './engine/gridEngine';
import {
  applyWeatherToGridControls,
  buildWeatherSnapshot,
  fetchMockWeatherFeed,
} from './engine/weatherService';
import {
  AgentLogEntry,
  AgentPipelineState,
  DivisionId,
  GridControls,
  MapEngineMode,
  NavView,
  OperatingMode,
  ScenarioId,
  WeatherFeedSnapshot,
  WeatherProfileId,
} from './engine/types';
import { Sidebar } from './components/layout/Sidebar';
import { TopTelemetryBar } from './components/layout/TopTelemetryBar';
import { GridMapView } from './components/map/GridMapView';
import { ControlBoardView } from './components/views/ControlBoardView';
import { AgentsWorkflowView } from './components/views/AgentsWorkflowView';
import { ProfitWastageView } from './components/views/ProfitWastageView';
import { OfficialReportView } from './components/views/OfficialReportView';

const ENV_MAPS_API_KEY: string =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  (typeof __GOOGLE_MAPS_API_KEY__ !== 'undefined' ? __GOOGLE_MAPS_API_KEY__ : '');

export default function App() {
  const [activeView, setActiveView] = useState<NavView>('map');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [controls, setControls] = useState<GridControls>(DEFAULT_CONTROLS);
  const [selectedDivisionId, setSelectedDivisionId] = useState<DivisionId | null>(null);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  // Mock Weather API state (BMD 8-division telemetry feeding Demand Forecast Agent)
  const [weather, setWeather] = useState<WeatherFeedSnapshot>(() =>
    buildWeatherSnapshot('seasonal_normal', 0, new Date(), true),
  );
  const [isPollingWeather, setIsPollingWeather] = useState(false);
  const weatherReqSeqRef = useRef(0);
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  const weatherRef = useRef(weather);
  weatherRef.current = weather;

  // Default to Google Maps when provisioned API key is present; otherwise instant Three.js 3D Grid Twin
  const [mapEngine, setMapEngine] = useState<MapEngineMode>(() =>
    ENV_MAPS_API_KEY ? 'google' : 'three3d',
  );

  const snapshot = useMemo(() => computeGridSnapshot(controls), [controls]);

  const [pipeline, setPipeline] = useState<AgentPipelineState>(() => {
    const initialWeather = buildWeatherSnapshot('seasonal_normal', 0, new Date(), true);
    return createInitialAgentPipeline(
      DEFAULT_CONTROLS,
      computeGridSnapshot(DEFAULT_CONTROLS),
      new Date(),
      initialWeather,
    );
  });

  // Listen for Google Maps Platform quota/auth events from main.tsx
  useEffect(() => {
    const handleQuota = () => {
      setMapsQuotaExceeded(true);
      setMapEngine('three3d');
    };
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Keep agent cards synchronized immediately whenever controls, grid snapshot, or weather change
  useEffect(() => {
    setPipeline((prev) => ({
      ...prev,
      agents: buildAgentNodes(controls, snapshot, prev.activeAgentIndex, weather),
    }));
  }, [controls, snapshot, weather]);

  // Continuous closed-loop agent stepping when autoRun is enabled
  useEffect(() => {
    if (!pipeline.autoRun) return;
    const timer = window.setInterval(() => {
      setPipeline((prev) => stepAgentCycle(prev, controls, snapshot, new Date(), weather));
    }, 2800);
    return () => window.clearInterval(timer);
  }, [pipeline.autoRun, controls, snapshot, weather]);

  const commitWeatherSnapshot = useCallback(
    (nextWeather: WeatherFeedSnapshot, shouldLog: boolean) => {
      const prevTriggered = weatherRef.current.autoTriggeredHeatwave;
      setWeather(nextWeather);

      const sync = applyWeatherToGridControls(controlsRef.current, nextWeather);
      if (sync.weatherAdjusted) {
        setControls(sync.nextControls);
      }

      const crossedHeatwaveBoundary = prevTriggered !== nextWeather.autoTriggeredHeatwave;
      if (shouldLog || crossedHeatwaveBoundary) {
        const now = new Date();
        setPipeline((prev) => {
          const entry: AgentLogEntry = {
            id: `weather-${prev.cycleCount}-${now.getTime()}`,
            cycle: prev.cycleCount,
            timestampBST: formatBSTTimeShort(now),
            agentId: 'forecast',
            agentName: 'Demand Forecast',
            severity: sync.triggeredHeatwave
              ? 'warning'
              : sync.weatherAdjusted
                ? 'action'
                : 'info',
            message: sync.logMessage,
          };
          return {
            ...prev,
            logs: [entry, ...prev.logs].slice(0, 32),
          };
        });
      }
    },
    [],
  );

  const handleSelectWeatherProfile = useCallback(
    async (profileId: WeatherProfileId) => {
      const reqId = ++weatherReqSeqRef.current;
      setIsPollingWeather(true);
      const nextWeather = await fetchMockWeatherFeed({
        profileId,
        tempOffsetC: 0,
        autoSyncEnabled: weatherRef.current.autoSyncEnabled,
        jitter: false,
        simulatedDelayMs: 90,
      });
      if (reqId !== weatherReqSeqRef.current) return;
      setIsPollingWeather(false);
      commitWeatherSnapshot(nextWeather, true);
    },
    [commitWeatherSnapshot],
  );

  const handleChangeWeatherTempOffset = useCallback(
    (offsetC: number) => {
      // Cancel any in-flight async poll so slider dragging stays immediately authoritative
      weatherReqSeqRef.current += 1;
      setIsPollingWeather(false);
      const nextWeather = buildWeatherSnapshot(
        weatherRef.current.profileId,
        offsetC,
        new Date(),
        weatherRef.current.autoSyncEnabled,
      );
      commitWeatherSnapshot(nextWeather, false);
    },
    [commitWeatherSnapshot],
  );

  const handlePollWeatherNow = useCallback(async () => {
    const reqId = ++weatherReqSeqRef.current;
    setIsPollingWeather(true);
    const nextWeather = await fetchMockWeatherFeed({
      profileId: weatherRef.current.profileId,
      tempOffsetC: weatherRef.current.tempOffsetC,
      autoSyncEnabled: weatherRef.current.autoSyncEnabled,
      jitter: true,
      simulatedDelayMs: 160,
    });
    if (reqId !== weatherReqSeqRef.current) return;
    setIsPollingWeather(false);
    commitWeatherSnapshot(nextWeather, true);
  }, [commitWeatherSnapshot]);

  const handleToggleWeatherAutoSync = useCallback(() => {
    const nextAutoSync = !weatherRef.current.autoSyncEnabled;
    const nextWeather = buildWeatherSnapshot(
      weatherRef.current.profileId,
      weatherRef.current.tempOffsetC,
      new Date(),
      nextAutoSync,
    );
    commitWeatherSnapshot(nextWeather, true);
  }, [commitWeatherSnapshot]);

  const handleChangeMode = useCallback((mode: OperatingMode) => {
    setControls((prev) => ({ ...prev, mode }));
  }, []);

  const handleSelectScenario = useCallback((scenarioId: Exclude<ScenarioId, 'custom'>) => {
    const preset = SCENARIO_PRESETS.find((p) => p.id === scenarioId);
    if (!preset) return;
    setControls((prev) => ({
      mode: prev.mode,
      ...preset.controls,
    }));
  }, []);

  const handleUpdateControls = useCallback((patch: Partial<GridControls>) => {
    setControls((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleZoomToDivision = useCallback((id: DivisionId) => {
    setSelectedDivisionId(id);
    setActiveView('map');
  }, []);

  const handleOpenWeatherFeed = useCallback(() => {
    setActiveView('agents');
  }, []);

  const handleStepAgentNow = useCallback(() => {
    setPipeline((prev) => stepAgentCycle(prev, controls, snapshot, new Date(), weather));
  }, [controls, snapshot, weather]);

  const handleToggleAutoRun = useCallback(() => {
    setPipeline((prev) => ({ ...prev, autoRun: !prev.autoRun }));
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#F4F6F9] text-[#0F172A] overflow-hidden">
      {/* Compact Non-Intrusive Google Maps Platform Quota Notice (shown only when quota fires) */}
      {mapsQuotaExceeded && (
        <div className="no-print bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Collapsible Left Sidebar */}
        <Sidebar
          activeView={activeView}
          onSelectView={setActiveView}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Main Workspace Column */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {/* Slim Top National Telemetry Bar */}
          <TopTelemetryBar
            mode={controls.mode}
            snapshot={snapshot}
            weather={weather}
            onToggleMode={handleChangeMode}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            onOpenWeatherFeed={handleOpenWeatherFeed}
          />

          {/* Active Dedicated View */}
          <main className="flex-1 min-h-0 relative overflow-hidden">
            {activeView === 'map' && (
              <GridMapView
                controls={controls}
                snapshot={snapshot}
                selectedDivisionId={selectedDivisionId}
                onSelectDivision={setSelectedDivisionId}
                onSelectScenario={handleSelectScenario}
                mapsApiKey={ENV_MAPS_API_KEY}
                mapEngine={mapEngine}
                onChangeMapEngine={setMapEngine}
                mapsQuotaExceeded={mapsQuotaExceeded}
              />
            )}

            {activeView === 'control' && (
              <ControlBoardView
                controls={controls}
                snapshot={snapshot}
                weather={weather}
                onChangeMode={handleChangeMode}
                onSelectScenario={handleSelectScenario}
                onUpdateControls={handleUpdateControls}
                onZoomToDivision={handleZoomToDivision}
                onOpenWeatherFeed={handleOpenWeatherFeed}
              />
            )}

            {activeView === 'agents' && (
              <AgentsWorkflowView
                controls={controls}
                snapshot={snapshot}
                pipeline={pipeline}
                weather={weather}
                isPollingWeather={isPollingWeather}
                onStepNow={handleStepAgentNow}
                onToggleAutoRun={handleToggleAutoRun}
                onSelectWeatherProfile={handleSelectWeatherProfile}
                onChangeWeatherTempOffset={handleChangeWeatherTempOffset}
                onToggleWeatherAutoSync={handleToggleWeatherAutoSync}
                onPollWeatherNow={handlePollWeatherNow}
              />
            )}

            {activeView === 'financials' && (
              <ProfitWastageView controls={controls} snapshot={snapshot} />
            )}

            {activeView === 'report' && (
              <OfficialReportView
                controls={controls}
                snapshot={snapshot}
                pipeline={pipeline}
                weather={weather}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
