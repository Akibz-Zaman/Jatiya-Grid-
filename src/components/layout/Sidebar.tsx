import React from 'react';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Cpu,
  FileText,
  Map as MapIcon,
  Sliders,
  X,
  Zap,
} from 'lucide-react';
import { NavView } from '../../engine/types';

interface SidebarProps {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: NavView;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'map', label: 'Grid Map', icon: MapIcon },
  { id: 'control', label: 'Control Board', icon: Sliders },
  { id: 'agents', label: 'AI Agents Workflow', icon: Cpu },
  { id: 'financials', label: 'Profit & Wastage', icon: BarChart3 },
  { id: 'report', label: 'Official Report', icon: FileText },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const handleSelect = (view: NavView) => {
    onSelectView(view);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/25 z-40 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Primary Navigation"
        className={`no-print fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200 transition-all duration-200 ease-out shrink-0 ${
          collapsed ? 'lg:w-[68px]' : 'lg:w-[232px]'
        } ${mobileOpen ? 'translate-x-0 w-[240px]' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="h-14 px-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            {(!collapsed || mobileOpen) && (
              <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap truncate">
                JatiyaGrid AI
              </span>
            )}
          </div>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                title={collapsed ? item.label : undefined}
                aria-current={active ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                } ${collapsed && !mobileOpen ? 'justify-center px-0' : ''}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {(!collapsed || mobileOpen) && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom Sidebar Footer & Collapse Control */}
        <div className="p-2.5 border-t border-slate-200 space-y-2">
          {(!collapsed || mobileOpen) && (
            <div className="px-2 py-1 text-[11px] text-slate-500 leading-snug">
              Bangladesh National Grid
              <br />
              AI Builders Congress 2026
            </div>
          )}

          <button
            type="button"
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand sidebar navigation' : 'Collapse sidebar navigation'}
            className={`hidden lg:flex w-full items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors whitespace-nowrap ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
