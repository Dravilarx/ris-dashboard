"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { DiagnosisMode } from '@/types/ris';

interface DiagnosisContextType {
  mode: DiagnosisMode;
  setMode: (mode: DiagnosisMode) => void;
  toggleHighContrast: () => void;
}

const DiagnosisContext = createContext<DiagnosisContextType | undefined>(undefined);

export function DiagnosisProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<DiagnosisMode>('dark');

  // Recuperar modo persistido si existe
  useEffect(() => {
    const saved = localStorage.getItem('ris_diagnosis_mode') as DiagnosisMode;
    if (saved) setMode(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('ris_diagnosis_mode', mode);
    // Aplicar clase global para selectores CSS específicos
    document.documentElement.setAttribute('data-diagnosis-mode', mode);
  }, [mode]);

  const toggleHighContrast = () => setMode(prev => prev === 'high-contrast' ? 'dark' : 'high-contrast');

  return (
    <DiagnosisContext.Provider value={{ mode, setMode, toggleHighContrast }}>
      <div className={mode === 'high-contrast' ? 'contrast-high' : ''}>
        {children}
      </div>
    </DiagnosisContext.Provider>
  );
}

export const useDiagnosis = () => {
  const context = useContext(DiagnosisContext);
  if (!context) throw new Error('useDiagnosis must be used within DiagnosisProvider');
  return context;
}
