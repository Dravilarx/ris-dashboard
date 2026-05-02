import { redirect } from 'next/navigation';

/**
 * /dashboard fue la vista separada "Lista del Radiólogo".
 * Ahora todo está consolidado en /worklist (Panel de Trabajo unificado).
 */
export default function DashboardRedirect() {
  redirect('/worklist');
}
