import React from 'react';
import { DivisionState } from '../../engine/types';

interface SubstationIconSvgProps {
  archetype: DivisionState['archetype'];
  status: DivisionState['status'];
  selected?: boolean;
}

const STATUS_ACCENTS: Record<DivisionState['status'], { main: string; light: string; stroke: string }> = {
  nominal: { main: '#059669', light: '#D1FAE5', stroke: '#047857' },
  elevated: { main: '#0284C7', light: '#E0F2FE', stroke: '#0369A1' },
  shedding: { main: '#D97706', light: '#FEF3C7', stroke: '#B45309' },
  critical: { main: '#E11D48', light: '#FFE4E6', stroke: '#BE123C' },
};

/**
 * Isometric 3D-styled electrical substation building architectural marker icon.
 * Tailored per grid archetype (Rooppur Nuclear hyperbolic cooling tower, 400kV GIS, HVDC, etc.)
 * with grounded shadow and clean semantic trim — zero bars/pillars.
 */
export const SubstationIconSvg: React.FC<SubstationIconSvgProps> = ({
  archetype,
  status,
  selected = false,
}) => {
  const accent = STATUS_ACCENTS[status];

  return (
    <svg
      width={selected ? 66 : 56}
      height={selected ? 58 : 50}
      viewBox="0 0 72 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="transition-transform duration-200 drop-shadow-[0_6px_8px_rgba(15,23,42,0.18)]"
      aria-hidden="true"
    >
      {/* Grounded Isometric Concrete Foundation Plinth */}
      <ellipse cx="36" cy="54" rx="28" ry="8" fill="#0F172A" fillOpacity="0.14" />
      <polygon
        points="36,36 64,47 36,58 8,47"
        fill="#E2E8F0"
        stroke={selected ? accent.main : '#94A3B8'}
        strokeWidth={selected ? 2 : 1.2}
      />
      <polygon points="8,47 36,58 36,61 8,50" fill="#CBD5E1" />
      <polygon points="64,47 36,58 36,61 64,50" fill="#94A3B8" />

      {/* Primary GIS Switchgear Building (Isometric Left Wing) */}
      <polygon points="15,34 33,27 44,32 26,39" fill="#FFFFFF" stroke="#64748B" strokeWidth="1" />
      <polygon points="15,34 26,39 26,49 15,44" fill="#F1F5F9" stroke="#64748B" strokeWidth="1" />
      <polygon points="26,39 44,32 44,42 26,49" fill="#CBD5E1" stroke="#64748B" strokeWidth="1" />

      {/* Roof Parapet & Status Accent Fascia */}
      <polygon points="15,34 26,39 44,32 44,35 26,42 15,37" fill={accent.main} />
      {/* Control Room Glass Window Strip */}
      <polygon points="29,40 41,35.5 41,38.5 29,43" fill="#38BDF8" />

      {/* Step-Up Power Transformers & Ceramic Bushings (Right Bay) */}
      <rect x="44" y="34" width="9" height="11" rx="2" fill="#475569" stroke="#334155" strokeWidth="1" />
      <line x1="46.5" y1="30" x2="46.5" y2="34" stroke="#E2E8F0" strokeWidth="2" />
      <line x1="50.5" y1="30" x2="50.5" y2="34" stroke="#E2E8F0" strokeWidth="2" />

      {/* 400kV Steel Gantry Portal Frame */}
      <line x1="55" y1="45" x2="55" y2="24" stroke="#475569" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="60" y1="43" x2="60" y2="26" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="51" y1="26" x2="62" y2="27.5" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" />
      {/* Overhead Copper Busbar */}
      <path d="M46.5 30 Q51 24 55 26.5" stroke="#B45309" strokeWidth="1.3" fill="none" />

      {/* Archetype-Specific Architectural Hero Landmark */}
      {archetype === 'nuclear' && (
        <g>
          {/* Rooppur Hyperbolic Nuclear Cooling Tower */}
          <path
            d="M19 32 C21 23, 21.5 16, 20 11 L30 11 C28.5 16, 29 23, 31 32 Z"
            fill="#F8FAFC"
            stroke="#475569"
            strokeWidth="1.2"
          />
          <ellipse cx="25" cy="11" rx="5" ry="1.8" fill={accent.light} stroke={accent.main} strokeWidth="1.3" />
          {/* VVER-1200 Reactor Containment Dome */}
          <path d="M32 29 A6.5 6.5 0 0 1 45 29 Z" fill="#FFFFFF" stroke="#475569" strokeWidth="1.1" />
          <rect x="32" y="29" width="13" height="4" fill="#E2E8F0" stroke="#475569" strokeWidth="1" />
        </g>
      )}

      {archetype === 'hvdc_thermal' && (
        <g>
          {/* Twin HVDC / Thermal Flue Stacks */}
          <rect x="21" y="13" width="4.5" height="19" rx="1" fill="#F8FAFC" stroke="#475569" strokeWidth="1" />
          <rect x="21" y="16" width="4.5" height="2.8" fill={accent.main} />
          <rect x="28" y="15" width="4.5" height="17" rx="1" fill="#F1F5F9" stroke="#475569" strokeWidth="1" />
          <rect x="28" y="18" width="4.5" height="2.8" fill={accent.main} />
        </g>
      )}

      {archetype === 'gis_metro' && (
        <g>
          {/* Dhaka 400kV GIS Skylight Monitor Pavilion */}
          <polygon points="21,29 33,24 39,27 27,32" fill="#E0F2FE" stroke="#0284C7" strokeWidth="1" />
          <polygon points="21,29 27,32 27,35 21,32" fill="#BAE6FD" />
        </g>
      )}

      {archetype === 'gas_hub' && (
        <g>
          {/* Sylhet Bibiyana CCGT Exhaust Stack */}
          <rect x="23" y="15" width="5.5" height="17" rx="1.2" fill="#E2E8F0" stroke="#475569" strokeWidth="1.1" />
          <rect x="23" y="18" width="5.5" height="2.6" fill={accent.main} />
        </g>
      )}

      {archetype === 'coastal_port' && (
        <g>
          {/* Chattogram Coastal Cooling & Switchyard Fans */}
          <ellipse cx="25" cy="30" rx="4.2" ry="2" fill="#334155" stroke="#0F172A" strokeWidth="0.9" />
          <ellipse cx="34" cy="27" rx="4.2" ry="2" fill="#334155" stroke="#0F172A" strokeWidth="0.9" />
        </g>
      )}

      {/* Selected Highlight Ring */}
      {selected && (
        <ellipse
          cx="36"
          cy="49"
          rx="31"
          ry="11"
          fill="none"
          stroke={accent.main}
          strokeWidth="2"
          strokeDasharray="4 3"
        />
      )}
    </svg>
  );
};
