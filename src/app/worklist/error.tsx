'use client';

import { useEffect } from 'react';

export default function WorklistError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[worklist] Error al cargar:', error);
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>
        No se pudo cargar el worklist
      </h2>
      <p style={{ opacity: 0.7, maxWidth: 440, marginBottom: '1.5rem', lineHeight: 1.5 }}>
        Puede ser un problema temporal de conexión con la base de datos.
        Revisa que la VPN (Tailscale) esté activa y reintenta.
      </p>
      <button
        onClick={() => reset()}
        style={{
          padding: '0.6rem 1.4rem',
          borderRadius: '0.5rem',
          border: '1px solid currentColor',
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
          fontSize: '0.95rem',
        }}
      >
        Reintentar
      </button>
    </div>
  );
}
