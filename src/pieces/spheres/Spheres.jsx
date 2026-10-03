import React, { useState, lazy, Suspense, useCallback, useEffect, useRef } from 'react';

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

// Desktop: the original vertical list on the left. Narrow screens (phone portrait): a
// horizontally scrollable row along the bottom. Short screens (phone landscape): the
// left-hand list, scrollable, clear of the centred sphere. Phones get 44px tap targets,
// and so do coarse pointers (tablets) on the desktop layout.
const NAV_CSS = `
  .spheres-nav {
    position: fixed;
    top: 50%;
    left: max(16px, env(safe-area-inset-left));
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 6px;
    z-index: 100;
  }
  .spheres-nav button {
    border-radius: 6px;
    padding: 7px 13px;
    font-size: 12px;
    letter-spacing: 0.04em;
    cursor: pointer;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: all 0.15s ease;
    white-space: nowrap;
  }
  @media (pointer: coarse) {
    .spheres-nav button { min-height: 44px; }
  }
  @media (max-height: 500px) and (min-width: 641px) {
    .spheres-nav {
      top: 0;
      bottom: 0;
      transform: none;
      gap: 8px;
      padding: max(12px, env(safe-area-inset-top)) 0 max(12px, env(safe-area-inset-bottom));
      overflow-y: auto;
      overscroll-behavior-y: contain;
      scrollbar-width: none;
      -webkit-mask-image: linear-gradient(to bottom, transparent, #000 12px, #000 calc(100% - 12px), transparent);
      mask-image: linear-gradient(to bottom, transparent, #000 12px, #000 calc(100% - 12px), transparent);
    }
    .spheres-nav::-webkit-scrollbar { display: none; }
    .spheres-nav button {
      flex: none;
      min-height: 44px;
      font-size: 13px;
    }
    .spheres-nav button:first-child { margin-top: auto; }
    .spheres-nav button:last-child { margin-bottom: auto; }
  }
  @media (max-width: 640px) {
    .spheres-nav {
      top: auto;
      left: 0;
      right: 0;
      bottom: 0;
      transform: none;
      flex-direction: row;
      gap: 8px;
      padding: 12px max(16px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
      overflow-x: auto;
      overscroll-behavior-x: contain;
      scrollbar-width: none;
      -webkit-mask-image: linear-gradient(to right, transparent, #000 16px, #000 calc(100% - 16px), transparent);
      mask-image: linear-gradient(to right, transparent, #000 16px, #000 calc(100% - 16px), transparent);
    }
    .spheres-nav::-webkit-scrollbar { display: none; }
    .spheres-nav button {
      flex: none;
      min-height: 44px;
      padding: 0 16px;
      font-size: 13px;
    }
  }
`;

export default function Spheres({ sub, onSubChange }) {
  const [active, setActive] = useState(() => scenes.find(s => s.id === sub)?.id ?? scenes[0].id);
  const [overlay, setOverlay] = useState(0);
  const navRef = useRef(null);

  const switchScene = useCallback((id) => {
    if (id === active) return;
    setOverlay(1);
    setTimeout(() => {
      setActive(id);
      onSubChange?.(id);
      setTimeout(() => setOverlay(0), INIT_MS);
    }, FADE_MS);
  }, [active, onSubChange]);

  // Follow hash changes made outside the switcher (e.g. a link to #spheres/sun).
  useEffect(() => {
    if (scenes.some(s => s.id === sub)) switchScene(sub);
  }, [sub]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the list scrolls (phones), keep the active button in view.
  useEffect(() => {
    const nav = navRef.current;
    const button = nav?.querySelector('[aria-current]');
    if (!button) return;
    nav.scrollTo({
      left: button.offsetLeft - (nav.clientWidth - button.offsetWidth) / 2,
      top: button.offsetTop - (nav.clientHeight - button.offsetHeight) / 2,
      behavior: 'smooth',
    });
  }, [active]);

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

      <style>{NAV_CSS}</style>
      <nav ref={navRef} className="spheres-nav">
        {scenes.map(s => (
          <button
            key={s.id}
            onClick={() => switchScene(s.id)}
            aria-current={active === s.id ? 'true' : undefined}
            style={{
              background: active === s.id ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.45)',
              color: active === s.id ? '#fff' : 'rgba(255,255,255,0.55)',
              border: active === s.id ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.12)',
            }}
          >
            {s.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
