import { lazy } from 'react';

// Every lab piece. React pieces open at `#<id>`; static pages live in `public/<id>/`.
// To add a Gizmo export: save it as src/pieces/<Name>.tsx and add a line here.
export const pieces = [
  { id: 'spheres',        title: 'Spheres',        component: lazy(() => import('./pieces/spheres/Spheres.jsx')) },
  { id: 'flowers',        title: 'Flowers',        static: true },
  { id: 'sushi-art',      title: 'Sushi Art',      static: true },
  { id: 'bauhaus-sushi',  title: 'Bauhaus Sushi',  component: lazy(() => import('./pieces/BauhausSushi.tsx')) },
  { id: 'colour-cycling', title: 'Colour Cycling', component: lazy(() => import('./pieces/ColourCycling.tsx')) },
  { id: 'contrast',       title: 'Contrast',       component: lazy(() => import('./pieces/Contrast.tsx')) },
  { id: 'dingbat-gacha',  title: 'Dingbat Gacha',  component: lazy(() => import('./pieces/DingbatGacha.tsx')) },
  { id: 'float',          title: 'Float',          component: lazy(() => import('./pieces/Float.tsx')) },
  { id: 'name-garden',    title: 'Name Garden',    component: lazy(() => import('./pieces/NameGarden.tsx')) },
  { id: 'harmonics',      title: 'Harmonics',      component: lazy(() => import('./pieces/Harmonics.tsx')) },
  { id: 'hyperknots',     title: 'Hyperknots',     component: lazy(() => import('./pieces/Hyperknots.tsx')) },
  { id: 'illusion',       title: 'Illusion',       component: lazy(() => import('./pieces/Illusion.tsx')) },
  { id: 'lava-lamp',      title: 'Lava Lamp',      component: lazy(() => import('./pieces/LavaLamp.tsx')) },
  { id: 'mosh',           title: 'Mosh',           component: lazy(() => import('./pieces/Mosh.tsx')) },
  { id: 'noise',          title: 'Noise',          component: lazy(() => import('./pieces/Noise.tsx')) },
  { id: 'spectrogram',    title: 'Spectrogram',    component: lazy(() => import('./pieces/Spectrogram.tsx')) },
  { id: 'warp',           title: 'Warp',           component: lazy(() => import('./pieces/Warp.tsx')) },
  { id: 'wipeout',        title: 'Wipeout',        component: lazy(() => import('./pieces/Wipeout.tsx')) },
];

export const pieceUrl = (piece) =>
  piece.static ? `${import.meta.env.BASE_URL}${piece.id}/` : `${import.meta.env.BASE_URL}#${piece.id}`;
