import React, { useEffect, useRef } from 'react';
import {
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
  APIProvider,
  Map as GoogleMap,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Building2, Factory, Hospital, Home } from 'lucide-react';
import { BANGLADESH_CENTER } from '../../engine/bangladeshData';
import { computeDivisionThermalZones } from '../../engine/thermalHeatmap';
import {
  CorridorFlowState,
  DivisionId,
  DivisionState,
  SubZoneState,
  WeatherFeedSnapshot,
} from '../../engine/types';
import { SubstationIconSvg } from './SubstationIconSvg';

interface GoogleBangladeshMapProps {
  apiKey: string;
  divisions: DivisionState[];
  corridors: CorridorFlowState[];
  weather: WeatherFeedSnapshot;
  showThermalOverlay: boolean;
  selectedDivisionId: DivisionId | null;
  onSelectDivision: (id: DivisionId) => void;
}

const SUBZONE_ICON_MAP = {
  hospitals: Hospital,
  cities: Building2,
  industrial: Factory,
  rural: Home,
};

/**
 * Synchronizes smooth camera pan & zoom when a division is selected or reset,
 * and draws animated 400kV/230kV power-flow transmission polylines + local sub-zone feeder lines.
 */
const MapCameraAndCorridors: React.FC<{
  divisions: DivisionState[];
  corridors: CorridorFlowState[];
  weather: WeatherFeedSnapshot;
  showThermalOverlay: boolean;
  selectedDivisionId: DivisionId | null;
  onSelectDivision: (id: DivisionId) => void;
}> = ({
  divisions,
  corridors,
  weather,
  showThermalOverlay,
  selectedDivisionId,
  onSelectDivision,
}) => {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const feederLinesRef = useRef<google.maps.Polyline[]>([]);
  const thermalPolygonsRef = useRef<google.maps.Polygon[]>([]);
  const thermalCirclesRef = useRef<google.maps.Circle[]>([]);

  // Smooth pan & zoom transition when selected division changes
  useEffect(() => {
    if (!map) return;
    if (selectedDivisionId) {
      const target = divisions.find((d) => d.id === selectedDivisionId);
      if (target) {
        map.panTo(target.position);
        map.setZoom(10.5);
      }
    } else {
      map.panTo(BANGLADESH_CENTER);
      map.setZoom(7);
    }
  }, [map, selectedDivisionId]);

  // Render animated transmission corridors via google.maps.Polyline with animated directional flow icons
  useEffect(() => {
    if (!map || !mapsLib) return;

    // Clean up existing polylines
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const created: google.maps.Polyline[] = corridors.map((cor) => {
      const strokeColor =
        cor.status === 'congested'
          ? '#E11D48'
          : cor.status === 'loaded'
            ? '#D97706'
            : cor.voltageKv === 400
              ? '#0284C7'
              : '#0D9488';

      const lineSymbol: google.maps.Symbol = {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: cor.voltageKv === 400 ? 2.8 : 2.3,
        strokeColor: strokeColor,
        fillColor: '#FFFFFF',
        fillOpacity: 1,
        strokeWeight: 1.6,
      };

      return new mapsLib.Polyline({
        path: [cor.fromPos, cor.toPos],
        geodesic: true,
        strokeColor,
        strokeOpacity: selectedDivisionId ? 0.35 : 0.72,
        strokeWeight: cor.voltageKv === 400 ? 3.2 : 2.2,
        icons: [
          {
            icon: lineSymbol,
            offset: '0%',
            repeat: '84px',
          },
        ],
        map,
      });
    });

    polylinesRef.current = created;

    // Animate directional flow pulses smoothly along transmission corridors
    let offset = 0;
    const timer = window.setInterval(() => {
      offset = (offset + 4) % 84;
      for (const poly of polylinesRef.current) {
        const icons = poly.get('icons');
        if (icons && icons[0]) {
          icons[0].offset = `${offset}px`;
          poly.set('icons', icons);
        }
      }
    }, 110);

    return () => {
      window.clearInterval(timer);
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, mapsLib, corridors, selectedDivisionId]);

  // Render local distribution feeder radial lines when zoomed into a specific division
  useEffect(() => {
    if (!map || !mapsLib) return;
    feederLinesRef.current.forEach((f) => f.setMap(null));
    feederLinesRef.current = [];

    if (!selectedDivisionId) return;
    const div = divisions.find((d) => d.id === selectedDivisionId);
    if (!div) return;

    const lines = div.subZones.map((sz) => {
      const color =
        sz.status === 'protected'
          ? '#059669'
          : sz.status === 'blackout'
            ? '#E11D48'
            : sz.status === 'rotating'
              ? '#D97706'
              : '#0284C7';
      return new mapsLib.Polyline({
        path: [div.position, sz.position],
        geodesic: false,
        strokeColor: color,
        strokeOpacity: 0.85,
        strokeWeight: 2.5,
        map,
      });
    });

    feederLinesRef.current = lines;
    return () => {
      feederLinesRef.current.forEach((f) => f.setMap(null));
      feederLinesRef.current = [];
    };
  }, [map, mapsLib, divisions, selectedDivisionId]);

  // Render dynamic 8-division thermal heatmap polygons + elevated thermal pressure radial halos
  useEffect(() => {
    if (!map || !mapsLib) return;

    thermalPolygonsRef.current.forEach((p) => p.setMap(null));
    thermalPolygonsRef.current = [];
    thermalCirclesRef.current.forEach((c) => c.setMap(null));
    thermalCirclesRef.current = [];

    if (!showThermalOverlay) return;

    const zones = computeDivisionThermalZones(weather);
    const zoomOpacityScale = selectedDivisionId ? 0.55 : 1.0;

    const createdPolys: google.maps.Polygon[] = [];
    const createdCircles: google.maps.Circle[] = [];

    for (const zone of zones) {
      const isSelected = selectedDivisionId === zone.divisionId;
      const poly = new mapsLib.Polygon({
        paths: zone.polygon,
        strokeColor: isSelected ? '#0F172A' : zone.style.strokeHex,
        strokeOpacity: isSelected ? 0.85 : 0.65,
        strokeWeight: isSelected ? 2.2 : 1.35,
        fillColor: zone.style.fillHex,
        fillOpacity: zone.style.fillOpacity * zoomOpacityScale,
        clickable: true,
        zIndex: isSelected ? 18 : 10,
        map,
      });

      poly.addListener('click', () => {
        onSelectDivision(zone.divisionId);
      });
      createdPolys.push(poly);

      // Add soft concentric thermal intensity core for warm / heatwave demand pressure zones
      const div = divisions.find((d) => d.id === zone.divisionId);
      if (div && zone.temperatureC >= 34.5) {
        const coreCircle = new mapsLib.Circle({
          center: div.position,
          radius: zone.hotspotRadiusMeters,
          strokeWeight: 0,
          fillColor: zone.style.fillHex,
          fillOpacity: (zone.heatwaveAlert ? 0.24 : 0.14) * zoomOpacityScale,
          clickable: false,
          zIndex: 14,
          map,
        });
        createdCircles.push(coreCircle);
      }
    }

    thermalPolygonsRef.current = createdPolys;
    thermalCirclesRef.current = createdCircles;

    return () => {
      thermalPolygonsRef.current.forEach((p) => p.setMap(null));
      thermalPolygonsRef.current = [];
      thermalCirclesRef.current.forEach((c) => c.setMap(null));
      thermalCirclesRef.current = [];
    };
  }, [map, mapsLib, weather, showThermalOverlay, divisions, selectedDivisionId, onSelectDivision]);

  return null;
};

const SubZoneBadgeMarker: React.FC<{ subZone: SubZoneState }> = ({ subZone }) => {
  const Icon = SUBZONE_ICON_MAP[subZone.category];
  const tone =
    subZone.status === 'protected'
      ? 'border-emerald-300 bg-white text-emerald-800'
      : subZone.status === 'blackout'
        ? 'border-rose-300 bg-white text-rose-800'
        : subZone.status === 'rotating'
          ? 'border-amber-300 bg-white text-amber-800'
          : 'border-sky-300 bg-white text-sky-800';

  return (
    <AdvancedMarker position={subZone.position} anchorPoint={AdvancedMarkerAnchorPoint.CENTER} zIndex={850}>
      <div className={`rounded-lg border px-2.5 py-1.5 shadow-md ${tone} min-w-[164px]`}>
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[11px] font-bold text-slate-900 truncate">{subZone.name}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2 font-mono text-[11px] tabular-nums">
          <span className="font-semibold">{subZone.supplyPct.toFixed(1)}%</span>
          <span className="text-slate-500">{subZone.allocatedMW} MW</span>
        </div>
      </div>
    </AdvancedMarker>
  );
};

export const GoogleBangladeshMap: React.FC<GoogleBangladeshMapProps> = ({
  apiKey,
  divisions,
  corridors,
  weather,
  showThermalOverlay,
  selectedDivisionId,
  onSelectDivision,
}) => {
  const selectedDivision = selectedDivisionId
    ? divisions.find((d) => d.id === selectedDivisionId) ?? null
    : null;

  // Sort northernmost first so southern markers render cleanly in front
  const sortedDivisions = [...divisions].sort((a, b) => b.position.lat - a.position.lat);

  return (
    <div className="w-full h-full" data-testid="google-bangladesh-map">
      <APIProvider apiKey={apiKey} libraries={['marker', 'maps']} language="en" region="BD">
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={BANGLADESH_CENTER}
          defaultZoom={7}
          gestureHandling="greedy"
          disableDefaultUI={false}
          zoomControl={true}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          <MapCameraAndCorridors
            divisions={divisions}
            corridors={corridors}
            weather={weather}
            showThermalOverlay={showThermalOverlay}
            selectedDivisionId={selectedDivisionId}
            onSelectDivision={onSelectDivision}
          />

          {sortedDivisions.map((div, index) => {
            const isSelected = selectedDivisionId === div.id;
            const weatherReading = weather.readings.find((r) => r.divisionId === div.id);
            const deltaPrefix = div.deltaPct > 0 ? '+' : '';
            const pctTextColor =
              div.status === 'critical'
                ? 'text-rose-700'
                : div.status === 'shedding'
                  ? 'text-amber-700'
                  : div.status === 'elevated'
                    ? 'text-sky-700'
                    : 'text-emerald-700';

            const borderColor = isSelected
              ? 'border-slate-900 ring-2 ring-slate-900/15'
              : div.status === 'critical'
                ? 'border-rose-300'
                : div.status === 'shedding'
                  ? 'border-amber-300'
                  : 'border-slate-200';

            const badgeOffsetClass =
              div.id === 'khulna'
                ? '-translate-x-9'
                : div.id === 'barishal'
                  ? 'translate-x-8'
                  : '';

            return (
              <AdvancedMarker
                key={div.id}
                position={div.position}
                anchorPoint={AdvancedMarkerAnchorPoint.BOTTOM}
                zIndex={isSelected ? 1000 : 100 + index}
                onClick={() => onSelectDivision(div.id)}
              >
                <button
                  type="button"
                  onClick={() => onSelectDivision(div.id)}
                  aria-label={`Zoom to ${div.name} substation: ${div.allocatedMW} MW, ${div.supplyPct.toFixed(1)}%`}
                  className="group flex flex-col items-center cursor-pointer focus-visible:outline-none"
                >
                  {/* Floating Percentage Badge directly above the 3D-styled Substation Building */}
                  <div
                    className={`mb-1 rounded-lg bg-white/95 border px-2 py-1 shadow-sm group-hover:shadow-md transition-all text-left ${borderColor} ${badgeOffsetClass}`}
                  >
                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                      <span className="text-[11px] font-bold text-slate-900 leading-none">
                        {div.name}
                      </span>
                      <span className="font-mono text-[10px] font-semibold text-slate-500 tabular-nums leading-none">
                        {div.allocatedMW.toLocaleString()} MW
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 whitespace-nowrap">
                      <span
                        className={`font-mono text-[10.5px] font-bold tabular-nums leading-none ${pctTextColor}`}
                      >
                        {div.supplyPct.toFixed(1)}% ({deltaPrefix}
                        {div.deltaPct.toFixed(1)}%)
                      </span>
                      {showThermalOverlay && weatherReading && (
                        <span
                          className={`font-mono text-[10px] font-bold tabular-nums leading-none ${
                            weatherReading.heatwaveAlert
                              ? 'text-rose-700'
                              : weatherReading.temperatureC >= 34.5
                                ? 'text-amber-700'
                                : weatherReading.temperatureC < 29
                                  ? 'text-sky-700'
                                  : 'text-slate-600'
                          }`}
                        >
                          {weatherReading.temperatureC.toFixed(1)}°C
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Custom 3D-styled Electrical Substation Building Icon */}
                  <SubstationIconSvg
                    archetype={div.archetype}
                    status={div.status}
                    selected={isSelected}
                  />
                </button>
              </AdvancedMarker>
            );
          })}

          {/* Local Sub-Zone Markers revealed on Zoom-In */}
          {selectedDivision &&
            selectedDivision.subZones.map((sz) => (
              <SubZoneBadgeMarker key={`${selectedDivision.id}-${sz.category}`} subZone={sz} />
            ))}
        </GoogleMap>
      </APIProvider>
    </div>
  );
};
