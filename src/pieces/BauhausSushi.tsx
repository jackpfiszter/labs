import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { gizmoRuntime } from '@gizmo/runtime';
import * as Tone from 'tone';

const tweaks = gizmoRuntime.tweaks({
  gridRows: { index: 0, name: 'Grid Rows', type: 'slider', value: 6.0, min: 1, max: 8, step: 1 },
  gridCols: { index: 1, name: 'Grid Columns', type: 'slider', value: 4.0, min: 1, max: 6, step: 1 },
  sushiChance: { index: 2, name: 'Sushi Chance', type: 'slider', value: 0.8, min: 0, max: 1, step: 0.05 },
  backgroundColor: { index: 3, name: 'Background', type: 'color', value: "#F0F0F0" },
  bauhausBlack: { index: 4, name: 'Bauhaus Black', type: 'color', value: '#000000' },
  bauhausWhite: { index: 5, name: 'Bauhaus White', type: 'color', value: '#FFFFFF' },
  bauhausRed: { index: 6, name: 'Bauhaus Red', type: 'color', value: '#E93323' },
  bauhausYellow: { index: 7, name: 'Bauhaus Yellow', type: 'color', value: '#FFDD46' },
  bauhausBlue: { index: 8, name: 'Bauhaus Blue', type: 'color', value: '#2227F5' },
  pageMargin: { index: 9, name: 'Page Margin', type: 'slider', value: 76.0, min: 0, max: 100, step: 1 },
  sushiSize: { index: 10, name: 'Sushi Size', type: 'slider', value: 0.7, min: 0.5, max: 2.0, step: 0.1 },
});

const SUSHI_TYPES = ['maki', 'nigiri', 'uramaki', 'gunkan'];

const createRandomSushi = (colors) => {
  const type = SUSHI_TYPES[Math.floor(Math.random() * SUSHI_TYPES.length)];
  const fillings = [colors.bauhausRed, colors.bauhausYellow, colors.bauhausBlue];

  return {
    id: Math.random(),
    type,
    filling1: fillings[Math.floor(Math.random() * fillings.length)],
    filling2: fillings[Math.floor(Math.random() * fillings.length)],
  };
};

const SushiPiece = React.memo(({ sushi, colors, sushiSize, scale = 1 }) => {
  if (!sushi) {
    return null;
  }

  const baseStyle = "w-full h-full flex items-center justify-center relative";
  // scale > 1 only when the grid cells are much larger than the original phone layout
  const sizeMultiplier = sushiSize * scale;

  switch (sushi.type) {
    case 'maki':
      return (
        <div className={baseStyle}>
          <div
            className="flex items-center justify-center"
            style={{
              width: `${80 * sizeMultiplier}px`,
              height: `${80 * sizeMultiplier}px`,
              backgroundColor: colors.bauhausBlack
            }}
          >
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: `${64 * sizeMultiplier}px`,
                height: `${64 * sizeMultiplier}px`,
                backgroundColor: colors.bauhausWhite
              }}
            >
              <div
                className="rounded-full"
                style={{
                  width: `${24 * sizeMultiplier}px`,
                  height: `${24 * sizeMultiplier}px`,
                  backgroundColor: sushi.filling1
                }}
              />
            </div>
          </div>
        </div>
      );
    case 'nigiri':
      return (
        <div className={baseStyle}>
          <div
            className="relative"
            style={{
              width: `${80 * sizeMultiplier}px`,
              height: `${48 * sizeMultiplier}px`
            }}
          >
            <div
              className="absolute bottom-0 left-0 w-full h-full"
              style={{ backgroundColor: colors.bauhausWhite }}
            />
            <div
              className="absolute top-0"
              style={{
                left: `${8 * scale}px`,
                width: `${64 * sizeMultiplier}px`,
                height: `${24 * sizeMultiplier}px`,
                backgroundColor: sushi.filling1
              }}
            />
          </div>
        </div>
      );
    case 'uramaki':
      return (
        <div className={baseStyle}>
          <div
            className="flex items-center justify-center"
            style={{
              width: `${80 * sizeMultiplier}px`,
              height: `${80 * sizeMultiplier}px`,
              backgroundColor: colors.bauhausWhite
            }}
          >
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: `${64 * sizeMultiplier}px`,
                height: `${64 * sizeMultiplier}px`,
                backgroundColor: colors.bauhausBlack
              }}
            >
              <div
                className="rounded-full"
                style={{
                  width: `${24 * sizeMultiplier}px`,
                  height: `${24 * sizeMultiplier}px`,
                  backgroundColor: sushi.filling1
                }}
              />
            </div>
          </div>
        </div>
      );
    case 'gunkan':
      return (
        <div className={baseStyle}>
          <div
            className="relative"
            style={{
              width: `${64 * sizeMultiplier}px`,
              height: `${80 * sizeMultiplier}px`
            }}
          >
            <div
              className="absolute bottom-0 left-0 w-full h-full"
              style={{ backgroundColor: colors.bauhausBlack }}
            />
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-full"
              style={{
                top: `${8 * scale}px`,
                width: `${48 * sizeMultiplier}px`,
                height: `${48 * sizeMultiplier}px`,
                backgroundColor: sushi.filling1
              }}
            />
          </div>
        </div>
      );
    default:
      return <div />;
  }
});

export default function Component() {
  const gridRows = tweaks.gridRows.useState();
  const gridCols = tweaks.gridCols.useState();
  const sushiChance = tweaks.sushiChance.useState();
  const backgroundColor = tweaks.backgroundColor.useState();
  const bauhausBlack = tweaks.bauhausBlack.useState();
  const bauhausWhite = tweaks.bauhausWhite.useState();
  const bauhausRed = tweaks.bauhausRed.useState();
  const bauhausYellow = tweaks.bauhausYellow.useState();
  const bauhausBlue = tweaks.bauhausBlue.useState();
  const pageMargin = tweaks.pageMargin.useState();
  const sushiSize = tweaks.sushiSize.useState();

  const colors = useMemo(() => ({
    bauhausBlack, bauhausWhite, bauhausRed, bauhausYellow, bauhausBlue
  }), [bauhausBlack, bauhausWhite, bauhausRed, bauhausYellow, bauhausBlue]);

  const [grid, setGrid] = useState([]);
  const synthRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Track the container size (works inside iframes / on orientation change)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => {
    synthRef.current?.dispose();
    synthRef.current = null;
  }, []);

  const regenerateGrid = useCallback(() => {
    const newGrid = Array.from({ length: gridRows * gridCols }, () =>
      Math.random() < sushiChance ? createRandomSushi(colors) : null
    );
    setGrid(newGrid);
  }, [gridRows, gridCols, sushiChance, colors]);

  useEffect(() => {
    regenerateGrid();
  }, [regenerateGrid]);

  const handleTap = useCallback(async () => {
    gizmoRuntime.performHaptic('light');
    regenerateGrid();
    // Audio can only start inside a user gesture; create the synth lazily
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
    if (!synthRef.current) {
      synthRef.current = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.1 }
      }).toDestination();
    }
    const notes = ['C4', 'E4', 'G4', 'A4', 'C5'];
    const randomNote = notes[Math.floor(Math.random() * notes.length)];
    synthRef.current.triggerAttackRelease(randomNote, '8n');
  }, [regenerateGrid]);

  // Keyboard: Space / Enter reshuffles
  useEffect(() => {
    const onKey = (e) => {
      if ((e.code === 'Space' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleTap]);

  // In landscape, lay the grid out sideways so it fits short screens
  const isLandscape = size.width > size.height;
  const cols = isLandscape ? gridRows : gridCols;
  const rows = isLandscape ? gridCols : gridRows;
  const margin = Math.min(pageMargin, Math.min(size.width, size.height) * 0.2 || pageMargin);
  const gap = 16;
  const cellW = (size.width - margin * 2 - gap * (cols - 1)) / cols;
  const cellH = (size.height - margin * 2 - gap * (rows - 1)) / rows;
  // Grow pieces only when cells are much bigger than on a phone (desktop)
  const scale = Math.max(1, (0.6 * Math.min(cellW, cellH)) / (80 * sushiSize)) || 1;

  return (
    <>
      <div aria-hidden className="fixed inset-0 -z-10" style={{ backgroundColor }} />
      <div
        ref={containerRef}
        className="h-screen w-screen flex items-center justify-center cursor-pointer"
        onPointerDown={(e) => { if (e.button === 0) handleTap(); }}
        style={{ padding: margin }}
      >
        <div
          className="gap-4"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            width: '100%',
            height: '100%',
          }}
        >
          {grid.map((sushi, i) => (
            <div key={sushi ? `${i}-${sushi.id}` : i} className="w-full h-full flex items-center justify-center">
              <SushiPiece sushi={sushi} colors={colors} sushiSize={sushiSize} scale={scale} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}