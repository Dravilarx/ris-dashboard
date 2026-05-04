"use client";

import React, { useState } from 'react';
import {
  ClipboardList,
  Activity,
  BarChart2,
  Users,
  Settings,
  Bell,
  Monitor,
  LogOut,
  Menu,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  href: string;
  accent?: 'cyan' | 'violet' | 'slate';
}

// NAVEGACION PRINCIPAL
const PRIMARY_NAV: NavItem[] = [
  {
    icon: ClipboardList,
    label: 'Panel de Trabajo',
    sublabel: 'Worklist Unificado',
    href: '/worklist',
    accent: 'cyan',
  },
  {
    icon: BarChart2,
    label: 'Estadisticas',
    sublabel: 'Produccion y SLA',
    href: '/estadisticas',
    accent: 'violet',
  },
];

const SECONDARY_NAV: NavItem[] = [
  { icon: Users,    label: 'Pacientes',  href: '#', accent: 'slate' },
  { icon: Monitor,  label: 'Monitor 2',  href: '#', accent: 'slate' },
];

interface SidebarItemProps {
  item: NavItem;
  isActive: boolean;
  isCollapsed: boolean;
}

const SidebarItem = ({ item, isActive, isCollapsed }: SidebarItemProps) => {
  const Icon = item.icon;

  const accentMap = {
    cyan: {
      active: 'border-r-2 border-cyan-400 bg-cyan-500/10 text-cyan-400',
      dot: 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]',
      icon: 'text-cyan-400',
    },
    violet: {
      active: 'border-r-2 border-violet-400 bg-violet-500/10 text-violet-400',
      dot: 'bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]',
      icon: 'text-violet-400',
    },
    slate: {
      active: 'border-r-2 border-slate-400 bg-white/5 text-slate-300',
      dot: 'bg-slate-400',
      icon: 'text-slate-400',
    },
  };

  const colors = accentMap[item.accent ?? 'slate'];

  return (
    <Link
      href={item.href}
      className={`
        group flex items-center gap-3 px-4 py-3 transition-all duration-200 relative
        ${isActive ? colors.active : 'text-text-muted hover:text-text-main hover:bg-white/5'}
      `}
      title={isCollapsed ? item.label : undefined}
    >
      {/* Icono */}
      <Icon
        size={18}
        className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${
          isActive ? colors.icon : ''
        }`}
      />

      {/* Texto (visible solo si no está colapsado) */}
      {!isCollapsed && (
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold leading-none">{item.label}</div>
          {item.sublabel && (
            <div className="text-[9px] font-black uppercase tracking-[0.15em] opacity-40 mt-0.5">
              {item.sublabel}
            </div>
          )}
        </div>
      )}

      {/* Indicador activo */}
      {isActive && !isCollapsed && (
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />
      )}
    </Link>
  );
};

// ─── SEPARADOR DE SECCIÓN ────────────────────────────────────────────────────
const SidebarDivider = ({ label, isCollapsed }: { label: string; isCollapsed: boolean }) => (
  <div className="px-4 pt-5 pb-2">
    {!isCollapsed ? (
      <span className="text-[8px] font-black uppercase tracking-[0.25em] text-white/20">{label}</span>
    ) : (
      <div className="h-px bg-white/5 mx-1" />
    )}
  </div>
);

// ─── PROP DE ACTIVE VIEW OVERRIDE (para sobreescribir desde la página) ────────
interface DashboardLayoutProps {
  children: React.ReactNode;
  /** Forzar qué item del sidebar aparece activo. Si no se pasa, se usa pathname. */
  activeView?: 'worklist' | 'dashboard' | 'estadisticas';
}

export default function DashboardLayout({ children, activeView }: DashboardLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (activeView) {
      return href === `/${activeView}`;
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ─── SIDEBAR ──────────────────────────────────────────────────────── */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 64 : 240 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="relative z-50 flex flex-col glass-panel sidebar-gradient overflow-hidden"
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-glass-border shrink-0">
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="text-xl font-bold bg-gradient-to-r from-accent to-white bg-clip-text text-transparent whitespace-nowrap overflow-hidden"
              >
                AMIS <span className="text-xs font-light text-text-muted">RIS 2030</span>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-white transition-all ml-auto shrink-0"
            title={isCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            <motion.div animate={{ rotate: isCollapsed ? 0 : 180 }} transition={{ duration: 0.25 }}>
              <ChevronRight size={18} />
            </motion.div>
          </button>
        </div>

        {/* Nav principal */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
          <SidebarDivider label="Bandejas de Trabajo" isCollapsed={isCollapsed} />

          {PRIMARY_NAV.map((item) => (
            <SidebarItem
              key={item.label}
              item={item}
              isActive={isActive(item.href)}
              isCollapsed={isCollapsed}
            />
          ))}

          <SidebarDivider label="Módulos" isCollapsed={isCollapsed} />

          {SECONDARY_NAV.map((item) => (
            <SidebarItem
              key={item.label}
              item={item}
              isActive={isActive(item.href)}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>

        {/* Footer del sidebar */}
        <div className="shrink-0 border-t border-glass-border py-2">
          <SidebarItem
            item={{ icon: Settings, label: 'Configuración', href: '#', accent: 'slate' }}
            isActive={false}
            isCollapsed={isCollapsed}
          />
          <SidebarItem
            item={{ icon: LogOut, label: 'Cerrar sesión', href: '#', accent: 'slate' }}
            isActive={false}
            isCollapsed={isCollapsed}
          />
        </div>
      </motion.aside>

      {/* ─── ÁREA PRINCIPAL ───────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        {/* Header Superior */}
        <header className="h-16 shrink-0 flex items-center justify-between px-6 glass-panel border-0 border-b border-glass-border z-10">
          <div className="flex items-center gap-4 flex-1">
            {/* Breadcrumb contextual */}
            <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-muted">
              <span>AMIS RIS 2030</span>
              <ChevronRight size={10} className="opacity-30" />
              <span className="text-text-main">
                {pathname.startsWith('/worklist')
                  ? 'Panel de Trabajo'
                  : pathname.startsWith('/estadisticas')
                  ? 'Estadisticas'
                  : pathname.startsWith('/informe')
                  ? 'Dictado de Informe'
                  : 'Sistema'}
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-6">
            {/* Notificaciones */}
            <div className="relative cursor-pointer text-text-muted hover:text-text-main transition-colors">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-danger rounded-full border-2 border-background" />
            </div>

            {/* Usuario */}
            <div className="flex items-center gap-3 border-l border-glass-border pl-6">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold">Dr. Marcelo Ávila</div>
                <div className="text-[10px] text-text-muted">Radiólogo Senior</div>
              </div>
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-background font-bold text-xs ring-2 ring-accent/20 shrink-0">
                MA
              </div>
            </div>
          </div>
        </header>

        {/* Content Viewport */}
        <section className="flex-1 overflow-auto p-6 scroll-smooth">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}
