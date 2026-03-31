"use client";

import React, { useState } from 'react';
import { 
  ClipboardList, 
  Activity, 
  Users, 
  Settings, 
  Search, 
  Bell, 
  Monitor, 
  LogOut, 
  Menu,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  collapsed?: boolean;
}

const SidebarItem = ({ icon: Icon, label, active = false, collapsed = false }: SidebarItemProps) => (
  <div className={`
    group flex items-center px-4 py-3 cursor-pointer transition-all duration-300
    ${active ? 'border-r-2 border-accent bg-accent-glow text-accent' : 'text-text-muted hover:text-text-main hover:bg-white/5'}
  `}>
    <Icon size={20} className="shrink-0" />
    {!collapsed && (
      <span className="ml-3 text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300">
        {label}
      </span>
    )}
  </div>
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar con Glassmorphism */}
      <motion.aside 
        initial={false}
        animate={{ width: isCollapsed ? '64px' : '240px' }}
        className="relative z-50 flex flex-col glass-panel sidebar-gradient"
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-glass-border">
          {!isCollapsed && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="text-xl font-bold bg-gradient-to-r from-accent to-white bg-clip-text text-transparent"
             >
              AMIS <span className="text-xs font-light text-text-muted">RIS 2030</span>
            </motion.div>
          )}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-md hover:bg-white/10 text-text-muted"
          >
            <Menu size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <SidebarItem icon={ClipboardList} label="Worklist" active collapsed={isCollapsed} />
          <SidebarItem icon={Activity} label="Estadísticas" collapsed={isCollapsed} />
          <SidebarItem icon={Users} label="Pacientes" collapsed={isCollapsed} />
          <SidebarItem icon={Monitor} label="Monitor 2" collapsed={isCollapsed} />
        </div>

        <div className="p-4 border-t border-glass-border">
          <SidebarItem icon={Settings} label="Configuración" collapsed={isCollapsed} />
          <SidebarItem icon={LogOut} label="Salir" collapsed={isCollapsed} />
        </div>
      </motion.aside>

      {/* Área Principal */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header Superior */}
        <header className="h-16 flex items-center justify-between px-6 glass-panel border-0 border-b border-glass-border">
          <div className="flex items-center gap-4 flex-1">
            {/* Espacio reservado para herramientas contextuales */}
          </div>

          <div className="flex items-center gap-6">
            <div className="relative cursor-pointer text-text-muted hover:text-text-main transition-colors">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-danger rounded-full border-2 border-background"></span>
            </div>
            
            <div className="flex items-center gap-3 border-l border-glass-border pl-6">
              <div className="text-right">
                <div className="text-xs font-semibold">Dr. Marcelo Ávila</div>
                <div className="text-[10px] text-text-muted">Radiólogo Senior</div>
              </div>
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-background font-bold text-xs ring-2 ring-accent/20">
                MA
              </div>
            </div>
          </div>
        </header>

        {/* Content Viewport */}
        <section className="flex-1 overflow-auto p-6 scroll-smooth">
          <AnimatePresence mode="wait">
            <motion.div
              key="page-content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
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
