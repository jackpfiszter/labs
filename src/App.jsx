import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { pieces, pieceUrl } from './pieces.js';

// `#spheres/atomic` → { id: 'spheres', sub: 'atomic' }
const parseHash = () => {
  const [id, sub] = window.location.hash.slice(1).split('/');
  return { id, sub };
};

export default function App() {
  const [{ id, sub }, setRoute] = useState(parseHash);

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const onSubChange = useCallback((next) => history.replaceState(null, '', `#${id}/${next}`), [id]);

  const piece = pieces.find(p => p.id === id && p.component);
  if (!piece) return <Index />;

  const Piece = piece.component;
  return (
    <div className="relative w-full h-full overflow-hidden isolate">
      <Suspense fallback={null}>
        <Piece key={piece.id} sub={sub} onSubChange={onSubChange} />
      </Suspense>
    </div>
  );
}

function Index() {
  return (
    <div className="h-full overflow-y-auto bg-black text-white font-sans p-8">
      <h1 className="text-2xl mb-6">Labs</h1>
      <ul className="space-y-2">
        {pieces.map(p => (
          <li key={p.id}>
            <a href={pieceUrl(p)} className="opacity-70 hover:opacity-100 underline-offset-4 hover:underline">
              {p.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
