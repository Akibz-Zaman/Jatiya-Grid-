export type OperatingMode = 'autonomous' | 'manual';

export type ScenarioId = 'balanced' | 'heatwave' | 'rooppur_ramp' | 'deficit_crisis' | 'custom';

export type NavView = 'map' | 'control' | 'agents' | 'financials' | 'report';

export type MapEngineMode = 'google' | 'three3d';

export type DivisionId =
  | 'dhaka'
  | 'chattogram'
  | 'rajshahi'
  | 'khulna'
  | 'mymensingh'
  | 'rangpur'
  | 'sylhet'
  | 'barishal';

export type SubstationArchetype = 'gis_metro' | 'nuclear' | 'hvdc_thermal' | 'coastal_port' | 'gas_hub' | 'regional';

export type SubZoneCategory = 'hospitals' | 'cities' | 'industrial' | 'rural';

export interface SubZoneDefinition {
  category: SubZoneCategory;
  name: string;
  localLabel: string;
  demandShare: number; // sums to 1.0 per division
  latOffset: number;
  lngOffset: number;
  feederCount: number;
}

export interface DivisionConfig {
  id: DivisionId;
  name: string;
  hubName: string;
  voltageKv: number;
  archetype: SubstationArchetype;
  position: { lat: number; lng: number };
  demandShare: number; // sums to 1.0 nationally
  legacyPriorityWeight: number; // Manual NLDC bias (urban metro favored, rural neglected)
  generationNote: string;
  subZones: SubZoneDefinition[];
}

export interface TransmissionCorridor {
  id: string;
  from: DivisionId;
  to: DivisionId;
  voltageKv: 400 | 230;
  capacityMW: number;
  label: string;
}

export interface GridControls {
  mode: OperatingMode;
  scenario: ScenarioId;
  nationalDemandMW: number;
  rooppurNuclearMW: number; // 350 - 2400 MW
  gasLngMW: number; // 2500 - 9500 MW
  coalMW: number; // 800 - 4500 MW
  solarHydroMW: number; // 200 - 2200 MW
  hvdcImportMW: number; // 400 - 2400 MW
  feederSheddingCapPct: number; // 0 - 35 %
}

export interface SubZoneState {
  category: SubZoneCategory;
  name: string;
  localLabel: string;
  demandMW: number;
  allocatedMW: number;
  supplyPct: number;
  deltaPct: number;
  protected: boolean;
  rotationWindowMinutes: number; // 0 if uninterrupted, 15 in AI micro-shedding, 180-360 in manual legacy
  position: { lat: number; lng: number };
  feederCount: number;
  status: 'protected' | 'nominal' | 'rotating' | 'blackout';
}

export interface DivisionState {
  id: DivisionId;
  name: string;
  hubName: string;
  voltageKv: number;
  archetype: SubstationArchetype;
  position: { lat: number; lng: number };
  generationNote: string;
  demandMW: number;
  allocatedMW: number;
  deficitMW: number;
  supplyPct: number;
  deltaPct: number; // signed delta from 100%, e.g., -16.0 or 0.0
  status: 'nominal' | 'elevated' | 'shedding' | 'critical';
  subZones: SubZoneState[];
}

export interface CorridorFlowState {
  id: string;
  from: DivisionId;
  to: DivisionId;
  fromPos: { lat: number; lng: number };
  toPos: { lat: number; lng: number };
  voltageKv: 400 | 230;
  flowMW: number;
  capacityMW: number;
  utilizationPct: number;
  status: 'nominal' | 'loaded' | 'congested';
  label: string;
}

export interface FinancialMetrics {
  dailyProfitSavedCrore: number; // ৳ Crore/day saved in current active operating state
  dailyMwSaved: number; // MW equivalent saved/displaced from peakers + congestion loss avoided
  dailyLossWastageCrore: number; // ৳ Crore/day lost to peakers, congestion & unserved load
  dailyMwLost: number; // MW unserved or wasted
  annualizedNetGainCrore: number; // ৳ Crore/year
  peakerFuelReductionPct: number; // % reduction in expensive diesel/HFO peaker usage
  peakerDispatchMW: number;
  equityIndexScore: number; // 0-100 fairness across 8 divisions
  comparison: {
    autonomousDailySavedCrore: number;
    manualDailySavedCrore: number;
    autonomousDailyWastageCrore: number;
    manualDailyWastageCrore: number;
    autonomousPeakerMW: number;
    manualPeakerMW: number;
    autonomousRuralAvgPct: number;
    manualRuralAvgPct: number;
    autonomousHospitalsPct: number;
    manualHospitalsPct: number;
    autonomousFrequencyHz: number;
    manualFrequencyHz: number;
  };
}

export interface GridSnapshot {
  totalSupplyMW: number;
  totalDemandMW: number;
  nonNuclearDispatchMW: number;
  peakerDispatchMW: number;
  reserveMarginMW: number;
  balancePct: number;
  frequencyHz: number;
  frequencyStatus: 'Nominal' | 'Guardrail Active' | 'Under-Freq Alert' | 'Over-Freq Alert';
  divisions: DivisionState[];
  corridors: CorridorFlowState[];
  financials: FinancialMetrics;
}

export type AgentId = 'forecast' | 'dispatch' | 'shedding' | 'guardrail';

export interface AgentNodeState {
  id: AgentId;
  stepNumber: number;
  name: string;
  shortName: string;
  role: string;
  status: 'active' | 'verified' | 'standby' | 'bypassed';
  latencyMs: number;
  primaryMetricLabel: string;
  primaryMetricValue: string;
  lastAction: string;
}

export interface AgentLogEntry {
  id: string;
  cycle: number;
  timestampBST: string;
  agentId: AgentId;
  agentName: string;
  severity: 'info' | 'action' | 'guardrail' | 'warning';
  message: string;
}

export interface AgentPipelineState {
  cycleCount: number;
  activeAgentIndex: number;
  autoRun: boolean;
  agents: AgentNodeState[];
  logs: AgentLogEntry[];
}

export type WeatherProfileId =
  | 'seasonal_normal'
  | 'pre_monsoon_warm'
  | 'severe_heatwave'
  | 'monsoon_cool';

export type WeatherCondition =
  | 'Clear'
  | 'Partly Cloudy'
  | 'Humid Haze'
  | 'Severe Heatwave'
  | 'Monsoon Rain';

export interface DivisionWeatherReading {
  divisionId: DivisionId;
  divisionName: string;
  temperatureC: number;
  feelsLikeC: number;
  humidityPct: number;
  condition: WeatherCondition;
  coolingLoadDeltaMW: number;
  heatwaveAlert: boolean;
}

export interface WeatherForecastParameters {
  heatwaveThresholdC: number;
  heatwaveTriggered: boolean;
  maxTempC: number;
  nationalAvgTempC: number;
  avgHumidityPct: number;
  hottestDivisionId: DivisionId;
  hottestDivisionName: string;
  coolingElasticityMwPerC: number;
  projectedCoolingSurgeMW: number;
  horizon15MinRampMW: number;
  recommendedDemandMW: number;
}

export interface WeatherFeedSnapshot {
  profileId: WeatherProfileId;
  tempOffsetC: number;
  sourceLabel: string;
  endpointUrl: string;
  fetchedAtBST: string;
  latencyMs: number;
  autoSyncEnabled: boolean;
  autoTriggeredHeatwave: boolean;
  readings: DivisionWeatherReading[];
  forecastParams: WeatherForecastParameters;
}

