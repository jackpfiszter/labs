import React, { useState, lazy, Suspense, useCallback } from 'react';

const scenes = [
  { id: 'fluffyball',  label: 'Fluffy Ball',     component: lazy(() => import('./FluffyBall.jsx')) },
  { id: 'gumball',     label: 'Gumball',          component: lazy(() => import('./Gumball.jsx')) },
  { id: 'playstation', label: 'PlayStation Ball', component: lazy(() => import('./PlaystationBall.jsx')) },
  { id: 'skydisco',    label: 'Sky Disco',        component: lazy(() => import('./SkyDisco.jsx')) },
  { id: 'suncatcher',  label: 'Suncatcher',       component: lazy(() => import('./Suncatcher.jsx')) },
  { id: 'atomic',      label: 'Atomic',           component: lazy(() => import('./Atomic.tsx')) },
  { id: 'bubble',      label: 'Bubble',           component: lazy(() => import('./Bubble.tsx')) },
  { id: 'grassball',   label: 'Grass Ball',       component: lazy(() => import('./GrassBall.tsx')) },
  { id: 'sun',         label: 'Sun',              component: lazy(() => import('./Sun.tsx')) },
];


const FADE_MS = 180;
const INIT_MS = 250;

export default function Spheres({ sub, onSubChange }) {
  const [active, setActive] = useState(() => scenes.find(s => s.id === sub)?.id ?? scenes[0].id);
  const [overlay, setOverlay] = useState(0);

  const switchScene = useCallback((id) => {
    if (id === active) return;
    setOverlay(1);
    setTimeout(() => {
      setActive(id);
      onSubChange?.(id);
      setTimeout(() => setOverlay(0), INIT_MS);
    }, FADE_MS);
  }, [active, onSubChange]);

  const scene = scenes.find(s => s.id === active);
  const ActiveComponent = scene.component;

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', isolation: 'isolate', background: '#000' }}>
      <Suspense fallback={null}>
        <ActiveComponent />
      </Suspense>

      <div style={{
        position: 'absolute',
        inset: 0,
        background: '#000',
        opacity: overlay,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: 'none',
        zIndex: 50,
      }} />

      <nav style={{
        position: 'fixed',
        top: '50%',
        left: '16px',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        zIndex: 100,
      }}>
        {scenes.map(s => (
          <button
            key={s.id}
            onClick={() => switchScene(s.id)}
            style={{
              background: active === s.id ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.45)',
              color: active === s.id ? '#fff' : 'rgba(255,255,255,0.55)',
              border: active === s.id ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.12)',
              borderRadius: '6px',
              padding: '7px 13px',
              fontSize: '12px',
              letterSpacing: '0.04em',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {s.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
