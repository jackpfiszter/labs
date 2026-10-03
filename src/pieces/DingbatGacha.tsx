import React, { useState, useEffect, useCallback, useRef } from 'react';
import { gizmoRuntime } from '@gizmo/runtime';
import Matter from 'matter-js';

const tweaks = gizmoRuntime.tweaks({
  bgColor: { index: 0, name: 'Background Color', type: 'color', value: '#FFFFFF' },
  textColor: { index: 1, name: 'Text Color', type: 'color', value: '#000000' },
  dispenseText: { index: 2, name: 'Dispense Button', type: 'text', value: 'DISPENSE', group: 'dispense' },
  dispenseColor: { index: 3, name: 'Dispense Color', type: 'color', value: '#000000', group: 'dispense' },
  dispenseSize: { index: 4, name: 'Dispense Size', type: 'slider', value: 12.0, min: 12, max: 32, step: 1, group: 'dispense' },
  dispenseVisible: { index: 5, name: 'Show Dispense', type: 'toggle', value: true, group: 'dispense' },
  historyLabel: { index: 6, name: 'Collection Label', type: 'text', value: 'COLLECTION', group: 'history' },
  historyColor: { index: 7, name: 'Collection Color', type: 'color', value: '#000000', group: 'history' },
  historySize: { index: 8, name: 'Collection Size', type: 'slider', value: 10, min: 8, max: 20, step: 1, group: 'history' },
  historyVisible: { index: 9, name: 'Show Collection', type: 'toggle', value: true, group: 'history' },
  physicsForce: { index: 10, name: 'Physics Force', type: 'slider', value: 0.009000001, min: 0.001, max: 0.1, step: 0.001 },
  copySuccessText: { index: 11, name: 'Copy Success Text', type: 'text', value: 'COPIED!', group: 'copy' },
  copySuccessColor: { index: 12, name: 'Copy Success Color', type: 'color', value: '#000000', group: 'copy' },
  copySuccessSize: { index: 13, name: 'Copy Success Size', type: 'slider', value: 12, min: 8, max: 24, step: 1, group: 'copy' },
  copySuccessVisible: { index: 14, name: 'Show Copy Success', type: 'toggle', value: true, group: 'copy' },
});

// Dingbats (U+2700 to U+27BF)
const DINGBATS = [
  '✁', '✂', '✃', '✄', '✆', '✇', '✈', '✉', '✌', '✍', '✎', '✏', '✐', '✑', '✒', '✓', '✔', '✕', '✖', '✗', '✘', '✙', '✚', '✛', '✜', '✝', '✞', '✟', '✠', '✡', '✢', '✣', '✤', '✥', '✦', '✧', '✩', '✪', '✫', '✬', '✭', '✮', '✯', '✰', '✱', '✲', '✳', '✴', '✵', '✶', '✷', '✸', '✹', '✺', '✻', '✼', '✽', '✾', '✿', '❀', '❁', '❂', '❃', '❄', '❅', '❆', '❇', '❈', '❉', '❊', '❋', '❍', '❏', '❐', '❑', '❒', '❖', '❘', '❙', '❚', '❛', '❜', '❝', '❞', '❡', '❢', '❣', '❤', '❥', '❦', '❧', '➔', '➘', '➙', '➚', '➛', '➜', '➝', '➞', '➟', '➠', '➡', '➢', '➣', '➤', '➥', '➦', '➧', '➨', '➩', '➪', '➫', '➬', '➭', '➮', '➯', '➱', '➲', '➳', '➴', '➵', '➶', '➷', '➸', '➹', '➺', '➻', '➼', '➽', '➾'
];

// Alchemical Symbols (U+1F700 to U+1F77F)
const ALCHEMICAL = [
  '🜀', '🜁', '🜂', '🜃', '🜄', '🜅', '🜆', '🜇', '🜈', '🜉', '🜊', '🜋', '🜌', '🜍', '🜎', '🜏', '🜐', '🜑', '🜒', '🜓', '🜔', '🜕', '🜖', '🜗', '🜘', '🜙', '🜚', '🜛', '🜜', '🜝', '🜞', '🜟', '🜠', '🜡', '🜢', '🜣', '🜤', '🜥', '🜦', '🜧', '🜨', '🜩', '🜪', '🜫', '🜬', '🜭', '🜮', '🜯', '🜰', '🜱', '🜲', '🜳', '🜴', '🜵', '🜶', '🜷', '🜸', '🜹', '🜺', '🜻', '🜼', '🜽', '🜾', '🜿', '🝀', '🝁', '🝂', '🝃', '🝄', '🝅', '🝆', '🝇', '🝈', '🝉', '🝊', '🝋', '🝌', '🝍', '🝎', '🝏', '🝐', '🝑', '🝒', '🝓', '🝔', '🝕', '🝖', '🝗', '🝘', '🝙', '🝚', '🝛', '🝜', '🝝', '🝞', '🝟', '🝠', '🝡', '🝢', '🝣', '🝤', '🝥', '🝦', '🝧', '🝨', '🝩', '🝪', '🝫', '🝬', '🝭', '🝮', '🝯', '🝰'
];

// Miscellaneous Symbols (U+2600 to U+26FF)
// Filtering out common emojis and non-iconographic ones
const MISC_SYMBOLS = [
  '☀', '☁', '☂', '☃', '☄', '★', '☆', '☇', '☈', '☉', '☊', '☋', '☌', '☍', '☎', '☏', '☐', '☑', '☒', '☓', '☖', '☗', '☘', '☙', '☚', '☛', '☜', '☝', '☞', '☟', '☠', '☡', '☢', '☣', '☤', '☥', '☦', '☧', '☨', '☩', '☪', '☫', '☬', '☭', '☮', '☯', '☰', '☱', '☲', '☳', '☴', '☵', '☶', '☷', '☸', '☹', '☺', '☻', '☼', '☽', '☾', '☿', '♀', '♁', '♂', '♃', '♄', '♅', '♆', '♇', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '♔', '♕', '♖', '♗', '♘', '♙', '♚', '♛', '♜', '♝', '♞', '♟', '♠', '♡', '♢', '♣', '♤', '♥', '♦', '♧', '♨', '♩', '♪', '♫', '♬', '♭', '♮', '♯', '♰', '♱', '♲', '♳', '♴', '♵', '♶', '♷', '♸', '♹', '♺', '♻', '♼', '♽', '♾', '♿', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅', '⚇', '⚈', '⚉', '⚊', '⚋', '⚌', '⚍', '⚎', '⚏', '⚐', '⚑', '⚒', '⚓', '⚔', '⚕', '⚖', '⚗', '⚘', '⚙', '⚚', '⚛', '⚜', '⚝', '⚞', '⚟', '⚠', '⚡', '⚢', '⚣', '⚤', '⚥', '⚦', '⚧', '⚨', '⚩', '⚪', '⚫', '⚬', '⚭', '⚮', '⚯', '⚰', '⚱', '⚲', '⚳', '⚴', '⚵', '⚶', '⚷', '⚸', '⚹', '⚺', '⚻', '⚼', '⚽', '⚾', '⚿', '⛀', '⛁', '⛂', '⛃', '⛄', '⛅', '⛈', '⛎', '⛏', '⛑', '⛓', '⛔', '⛩', '⛪', '⛰', '⛱', '⛲', '⛳', '⛴', '⛵', '⛷', '⛸', '⛹', '⛺', '⛽'
]; // Removed hand emojis and other problematic symbols

const FULL_COLLECTION_SET = [...DINGBATS, ...ALCHEMICAL, ...MISC_SYMBOLS];

const STORAGE_KEY = 'gacha-collection-state-v13';

export default function Component() {
  const bgColor = tweaks.bgColor.useState();
  const textColor = tweaks.textColor.useState();
  const dispenseText = tweaks.dispenseText.useState();
  const dispenseColor = tweaks.dispenseColor.useState();
  const dispenseSize = tweaks.dispenseSize.useState();
  const dispenseVisible = tweaks.dispenseVisible.useState();
  const historyLabel = tweaks.historyLabel.useState();
  const historyColor = tweaks.historyColor.useState();
  const historySize = tweaks.historySize.useState();
  const historyVisible = tweaks.historyVisible.useState();
  const physicsForce = tweaks.physicsForce.useState();
  const copySuccessText = tweaks.copySuccessText.useState();
  const copySuccessColor = tweaks.copySuccessColor.useState();
  const copySuccessSize = tweaks.copySuccessSize.useState();
  const copySuccessVisible = tweaks.copySuccessVisible.useState();

  const sceneRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);
  const [collected, setCollected] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [isDispensing, setIsDispensing] = useState(false);
  const isCoarsePointer = useState(() => window.matchMedia?.('(pointer: coarse)').matches ?? true)[0];

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(collected)));
  }, [collected]);

  useEffect(() => {
    if (!sceneRef.current) return;

    const { Engine, Render, Runner, Bodies, Body, Composite, Mouse, MouseConstraint, Events } = Matter;
    const sceneEl = sceneRef.current;
    let width = sceneEl.clientWidth;
    let height = sceneEl.clientHeight;
    // Glyphs grow a little on big screens (1x at phone size, up to 1.5x)
    const glyphScale = Math.min(1.5, Math.max(1, Math.min(width, height) / 267));
    
    const engine = Engine.create();
    engineRef.current = engine;
    engine.world.gravity.y = 0;

    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: width,
        height: height,
        // Integer ratio so Matter's mouse mapping (parseInt of data-pixel-ratio) stays exact
        pixelRatio: Math.min(2, Math.ceil(window.devicePixelRatio || 1)),
        wireframes: false,
        background: 'transparent',
        showAngleIndicator: false,
        showVelocity: false,
        showCollisions: false,
        showAxes: false,
        showPositions: false,
        showBroadphase: false,
        showBounds: false,
        showInternalEdges: false,
        showDebug: false,
      },
    });

    const thickness = 100;
    const wallOptions = { 
      isStatic: true, 
      render: { visible: false } 
    };
    // Walls are long enough to survive any later resize; they are just repositioned
    const span = 10000;
    const ground = Bodies.rectangle(width / 2, height + thickness / 2, span, thickness, wallOptions);
    const wallLeft = Bodies.rectangle(-thickness / 2, height / 2, thickness, span, wallOptions);
    const wallRight = Bodies.rectangle(width + thickness / 2, height / 2, thickness, span, wallOptions);
    const ceiling = Bodies.rectangle(width / 2, -thickness / 2, span, thickness, wallOptions);
    
    Composite.add(engine.world, [ground, wallLeft, wallRight, ceiling]);

    const pool = FULL_COLLECTION_SET.filter(c => !collected.has(c));
    const displayPool = pool.length > 0 ? pool : FULL_COLLECTION_SET;
    
    // Optimization: Use a smaller body size for physics and limit total bodies if needed
    // but here we want to show all. We'll optimize by using circles for simpler collision math.
    const initialChars = displayPool.map((char) => {
      const x = Math.random() * (width - 40) + 20;
      const y = Math.random() * (height - 40) + 20;
      const body = Bodies.circle(x, y, 8 * glyphScale, {
        restitution: 0.8,
        friction: 0.001,
        frictionAir: 0.02, // Increased air friction for smoother movement
        label: char,
        render: { fillStyle: 'transparent' }
      });
      
      Matter.Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2
      });
      
      return body;
    });

    Composite.add(engine.world, initialChars);

    // Optimization: Use a single requestAnimationFrame loop for rendering text
    // instead of the 'afterRender' event which can be heavy with many bodies.
    // Actually, Matter's afterRender is fine, but we should optimize the loop.
    Events.on(render, 'afterRender', () => {
      const context = render.context;
      const bodies = Composite.allBodies(engine.world);
      context.font = `${16 * glyphScale}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = textColor;
      
      // Only render bodies that are within the viewport
      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        if (body.label && !body.isStatic) {
          context.save();
          context.translate(body.position.x, body.position.y);
          context.rotate(body.angle);
          context.fillText(body.label + '\uFE0E', 0, 0);
          context.restore();
        }
      }
    });

    const mouse = Mouse.create(render.canvas);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: { stiffness: 0.2, render: { visible: false } },
    });
    Composite.add(engine.world, mouseConstraint);
    render.mouse = mouse;
    // Don't hijack the scroll wheel (Matter preventDefaults it), and release drags outside the canvas
    mouse.element.removeEventListener('wheel', (mouse as any).mousewheel);
    window.addEventListener('mouseup', (mouse as any).mouseup);

    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);

    // Follow the container size (resize / orientation change / layout switch)
    const ro = new ResizeObserver(() => {
      const w = sceneEl.clientWidth;
      const h = sceneEl.clientHeight;
      if (!w || !h || (w === width && h === height)) return;
      width = w;
      height = h;
      Render.setSize(render, w, h);
      Body.setPosition(ground, { x: w / 2, y: h + thickness / 2 });
      Body.setPosition(wallLeft, { x: -thickness / 2, y: h / 2 });
      Body.setPosition(wallRight, { x: w + thickness / 2, y: h / 2 });
      Body.setPosition(ceiling, { x: w / 2, y: -thickness / 2 });
      Composite.allBodies(engine.world).forEach((b) => {
        if (b.isStatic) return;
        const r = 8 * glyphScale;
        const x = Math.min(Math.max(b.position.x, r), w - r);
        const y = Math.min(Math.max(b.position.y, r), h - r);
        if (x !== b.position.x || y !== b.position.y) Body.setPosition(b, { x, y });
      });
    });
    ro.observe(sceneEl);

    return () => {
      ro.disconnect();
      window.removeEventListener('mouseup', (mouse as any).mouseup);
      Runner.stop(runner);
      Render.stop(render);
      Composite.clear(engine.world, false);
      Engine.clear(engine);
      render.canvas?.remove();
    };
  }, [textColor, collected.size === FULL_COLLECTION_SET.length]);

  const handleCopy = useCallback(async (char: string) => {
    try {
      // Use the modern clipboard API
      await navigator.clipboard.writeText(char);
      setShowCopyFeedback(true);
      gizmoRuntime.performHaptic('light');
      setTimeout(() => setShowCopyFeedback(false), 1000);
    } catch (err) {
      console.error('Failed to copy: ', err);
      // Fallback for older browsers or restricted environments
      try {
        const textArea = document.createElement("textarea");
        textArea.value = char;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          setShowCopyFeedback(true);
          gizmoRuntime.performHaptic('light');
          setTimeout(() => setShowCopyFeedback(false), 1000);
        }
      } catch (fallbackErr) {
        console.error('Fallback copy failed: ', fallbackErr);
      }
    }
  }, []);

  const dispense = useCallback(() => {
    if (isDispensing || !engineRef.current) return;
    setIsDispensing(true);
    gizmoRuntime.performHaptic('medium');

    const bodies = Matter.Composite.allBodies(engineRef.current.world);
    const dynamicBodies = bodies.filter(b => !b.isStatic);
    
    if (dynamicBodies.length === 0) {
      setIsDispensing(false);
      return;
    }

    // Shake effect
    dynamicBodies.forEach(body => {
      Matter.Body.applyForce(body, body.position, {
        x: (Math.random() - 0.5) * physicsForce,
        y: (Math.random() - 0.5) * physicsForce
      });
    });
    
    const randomBody = dynamicBodies[Math.floor(Math.random() * dynamicBodies.length)];
    const char = randomBody.label;

    Matter.Composite.remove(engineRef.current.world, randomBody);

    setTimeout(() => {
      setResult(char);
      setCollected(prev => {
        const next = new Set(prev);
        next.add(char);
        return next;
      });
      setIsDispensing(false);
      gizmoRuntime.performHaptic('heavy');
    }, 600);
  }, [isDispensing]);

  // Keyboard: Space / Enter dispenses (unless a button or cell has focus)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'BUTTON') return;
      if ((e.code === 'Space' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        dispense();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispense]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col items-center font-mono" style={{ backgroundColor: bgColor, color: textColor }}>
      {/* Portrait: one scrolling column (as on the phone). Landscape: scene left, controls + collection right. */}
      <div className="z-10 flex flex-col landscape:flex-row items-center landscape:items-stretch landscape:gap-6 w-full h-full pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1.5rem,env(safe-area-inset-top))] landscape:pt-[max(1rem,env(safe-area-inset-top))] landscape:pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto landscape:overflow-hidden">
        <div className="w-full aspect-[4/3] landscape:aspect-auto landscape:w-auto landscape:flex-1 landscape:min-w-0 landscape:h-full relative overflow-hidden shrink-0 border border-current cursor-grab active:cursor-grabbing">
          <div ref={sceneRef} className="absolute inset-0 w-full h-full" style={{ touchAction: 'none' }} />
        </div>

        <div className="contents landscape:flex landscape:flex-col landscape:items-center landscape:shrink-0 landscape:w-[clamp(15rem,34vw,30rem)] landscape:h-full landscape:overflow-y-auto">
        <div className="mt-4 landscape:mt-0 flex flex-col items-center shrink-0">
          <div 
            onClick={() => result && handleCopy(result)}
            className={`w-24 h-24 lg:w-32 lg:h-32 flex items-center justify-center border border-current bg-white/50 transition-colors relative active:bg-black/5 ${result ? 'cursor-pointer [@media(hover:hover)]:hover:bg-black/5' : ''}`}
          >
            <span className={`text-6xl lg:text-7xl ${isDispensing ? 'animate-pulse opacity-20' : ''}`} style={{ fontVariantEmoji: 'text', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
              {result ? result + '︎' : ''}
            </span>
            {showCopyFeedback && copySuccessVisible && (
              <div 
                className="absolute inset-0 flex items-center justify-center bg-black z-20 animate-in fade-in zoom-in duration-150"
              >
                <div 
                  className="font-bold whitespace-nowrap"
                  style={{ color: '#FFFFFF', fontSize: `${copySuccessSize}px` }}
                >
                  {copySuccessText}
                </div>
              </div>
            )}
          </div>
          <div className="mt-2 text-[10px] lg:text-xs opacity-40 uppercase tracking-widest">{isCoarsePointer ? 'Tap' : 'Click'} to copy</div>
        </div>

        <div className="flex flex-col gap-4 w-full mt-4 shrink-0">
          {dispenseVisible && (
            <button
              onPointerDown={(e) => { if (e.button === 0) dispense(); }}
              onClick={(e) => { if (e.detail === 0) dispense(); }}
              disabled={isDispensing}
              className={`w-full py-4 border border-current font-bold tracking-widest transition-all flex items-center justify-center gap-2 ${isDispensing ? 'bg-black text-white' : 'cursor-pointer [@media(hover:hover)]:hover:bg-black/5 active:bg-black active:text-white'}`}
              style={{ color: isDispensing ? '#FFFFFF' : dispenseColor, fontSize: `${dispenseSize}px` }}
            >
              {dispenseText}
            </button>
          )}
        </div>

        {historyVisible && (
          <div className="mt-6 w-full pb-[max(2.5rem,env(safe-area-inset-bottom))] landscape:pb-0">
            <div className="flex items-center justify-between gap-2 mb-3 border-b border-current pb-1">
              <span style={{ color: historyColor, fontSize: `${historySize}px` }} className="uppercase font-bold tracking-widest">
                {historyLabel}
              </span>
              <span style={{ color: historyColor, fontSize: `${historySize}px` }} className="font-bold">
                [{collected.size}/{FULL_COLLECTION_SET.length}]
              </span>
            </div>
            <div className="grid grid-cols-8 landscape:grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1 justify-items-center">
              {FULL_COLLECTION_SET.map((char, i) => {
                const isCollected = collected.has(char);
                return (
                  <div
                    key={i}
                    onClick={() => isCollected && handleCopy(char)}
                    className={`relative w-full max-w-[2.75rem] aspect-square flex items-center justify-center border transition-all duration-300 ${
                      isCollected 
                        ? 'border-current opacity-100 scale-100 cursor-pointer [@media(hover:hover)]:hover:bg-black/5 active:bg-black active:text-white' 
                        : 'border-current/10 opacity-20 scale-90 grayscale'
                    }`}
                    style={{ fontSize: '16px', fontVariantEmoji: 'text', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
                  >
                    {char + '︎'}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        * {
          font-variant-emoji: text !important;
          user-select: none;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.2; transform: scale(0.95); }
          50% { opacity: 0.5; transform: scale(1.05); }
        }
        .animate-pulse {
          animation: pulse 0.3s infinite;
        }
        ::-webkit-scrollbar {
          width: 4px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.1);
          border-radius: 2px;
        }
      `}} />
    </div>
  );
}