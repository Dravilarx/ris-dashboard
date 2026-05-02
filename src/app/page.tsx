import { redirect } from 'next/navigation';

/**
 * Root de la aplicación AMIS RIS 2030.
 * Redirige al Worklist General (punto de entrada unificado).
 * 
 * Arquitectura de vistas:
 *  /worklist  → Worklist General (Tecnólogos Médicos — todos los estudios)
 *  /dashboard → Lista del Radiólogo (estudios listos para informe/dictado)
 *  /informe/[uid] → Panel de Dictado (informe individual por estudio)
 */
export default function RootPage() {
  redirect('/worklist');
}
