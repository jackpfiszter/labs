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
  'âœ', 'âœ‚', 'âœƒ', 'âœ„', 'âœ†', 'âœ‡', 'âœˆ', 'âœ‰', 'âœŒ', 'âœ', 'âœŽ', 'âœ', 'âœ', 'âœ‘', 'âœ’', 'âœ“', 'âœ”', 'âœ•', 'âœ–', 'âœ—', 'âœ˜', 'âœ™', 'âœš', 'âœ›', 'âœœ', 'âœ', 'âœž', 'âœŸ', 'âœ ', 'âœ¡', 'âœ¢', 'âœ£', 'âœ¤', 'âœ¥', 'âœ¦', 'âœ§', 'âœ©', 'âœª', 'âœ«', 'âœ¬', 'âœ­', 'âœ®', 'âœ¯', 'âœ°', 'âœ±', 'âœ²', 'âœ³', 'âœ´', 'âœµ', 'âœ¶', 'âœ·', 'âœ¸', 'âœ¹', 'âœº', 'âœ»', 'âœ¼', 'âœ½', 'âœ¾', 'âœ¿', 'â€', 'â', 'â‚', 'âƒ', 'â„', 'â…', 'â†', 'â‡', 'âˆ', 'â‰', 'âŠ', 'â‹', 'â', 'â', 'â', 'â‘', 'â’', 'â–', 'â˜', 'â™', 'âš', 'â›', 'âœ', 'â', 'âž', 'â¡', 'â¢', 'â£', 'â¤', 'â¥', 'â¦', 'â§', 'âž”', 'âž˜', 'âž™', 'âžš', 'âž›', 'âžœ', 'âž', 'âžž', 'âžŸ', 'âž ', 'âž¡', 'âž¢', 'âž£', 'âž¤', 'âž¥', 'âž¦', 'âž§', 'âž¨', 'âž©', 'âžª', 'âž«', 'âž¬', 'âž­', 'âž®', 'âž¯', 'âž±', 'âž²', 'âž³', 'âž´', 'âžµ', 'âž¶', 'âž·', 'âž¸', 'âž¹', 'âžº', 'âž»', 'âž¼', 'âž½', 'âž¾'
];

// Alchemical Symbols (U+1F700 to U+1F77F)
const ALCHEMICAL = [
  'ðŸœ€', 'ðŸœ', 'ðŸœ‚', 'ðŸœƒ', 'ðŸœ„', 'ðŸœ…', 'ðŸœ†', 'ðŸœ‡', 'ðŸœˆ', 'ðŸœ‰', 'ðŸœŠ', 'ðŸœ‹', 'ðŸœŒ', 'ðŸœ', 'ðŸœŽ', 'ðŸœ', 'ðŸœ', 'ðŸœ‘', 'ðŸœ’', 'ðŸœ“', 'ðŸœ”', 'ðŸœ•', 'ðŸœ–', 'ðŸœ—', 'ðŸœ˜', 'ðŸœ™', 'ðŸœš', 'ðŸœ›', 'ðŸœœ', 'ðŸœ', 'ðŸœž', 'ðŸœŸ', 'ðŸœ ', 'ðŸœ¡', 'ðŸœ¢', 'ðŸœ£', 'ðŸœ¤', 'ðŸœ¥', 'ðŸœ¦', 'ðŸœ§', 'ðŸœ¨', 'ðŸœ©', 'ðŸœª', 'ðŸœ«', 'ðŸœ¬', 'ðŸœ­', 'ðŸœ®', 'ðŸœ¯', 'ðŸœ°', 'ðŸœ±', 'ðŸœ²', 'ðŸœ³', 'ðŸœ´', 'ðŸœµ', 'ðŸœ¶', 'ðŸœ·', 'ðŸœ¸', 'ðŸœ¹', 'ðŸœº', 'ðŸœ»', 'ðŸœ¼', 'ðŸœ½', 'ðŸœ¾', 'ðŸœ¿', 'ðŸ€', 'ðŸ', 'ðŸ‚', 'ðŸƒ', 'ðŸ„', 'ðŸ…', 'ðŸ†', 'ðŸ‡', 'ðŸˆ', 'ðŸ‰', 'ðŸŠ', 'ðŸ‹', 'ðŸŒ', 'ðŸ', 'ðŸŽ', 'ðŸ', 'ðŸ', 'ðŸ‘', 'ðŸ’', 'ðŸ“', 'ðŸ”', 'ðŸ•', 'ðŸ–', 'ðŸ—', 'ðŸ˜', 'ðŸ™', 'ðŸš', 'ðŸ›', 'ðŸœ', 'ðŸ', 'ðŸž', 'ðŸŸ', 'ðŸ ', 'ðŸ¡', 'ðŸ¢', 'ðŸ£', 'ðŸ¤', 'ðŸ¥', 'ðŸ¦', 'ðŸ§', 'ðŸ¨', 'ðŸ©', 'ðŸª', 'ðŸ«', 'ðŸ¬', 'ðŸ­', 'ðŸ®', 'ðŸ¯', 'ðŸ°'
];

// Miscellaneous Symbols (U+2600 to U+26FF)
// Filtering out common emojis and non-iconographic ones
const MISC_SYMBOLS = [
  'â˜€', 'â˜', 'â˜‚', 'â˜ƒ', 'â˜„', 'â˜…', 'â˜†', 'â˜‡', 'â˜ˆ', 'â˜‰', 'â˜Š', 'â˜‹', 'â˜Œ', 'â˜', 'â˜Ž', 'â˜', 'â˜', 'â˜‘', 'â˜’', 'â˜“', 'â˜–', 'â˜—', 'â˜˜', 'â˜™', 'â˜š', 'â˜›', 'â˜œ', 'â˜', 'â˜ž', 'â˜Ÿ', 'â˜ ', 'â˜¡', 'â˜¢', 'â˜£', 'â˜¤', 'â˜¥', 'â˜¦', 'â˜§', 'â˜¨', 'â˜©', 'â˜ª', 'â˜«', 'â˜¬', 'â˜­', 'â˜®', 'â˜¯', 'â˜°', 'â˜±', 'â˜²', 'â˜³', 'â˜´', 'â˜µ', 'â˜¶', 'â˜·', 'â˜¸', 'â˜¹', 'â˜º', 'â˜»', 'â˜¼', 'â˜½', 'â˜¾', 'â˜¿', 'â™€', 'â™', 'â™‚', 'â™ƒ', 'â™„', 'â™…', 'â™†', 'â™‡', 'â™ˆ', 'â™‰', 'â™Š', 'â™‹', 'â™Œ', 'â™', 'â™Ž', 'â™', 'â™', 'â™‘', 'â™’', 'â™“', 'â™”', 'â™•', 'â™–', 'â™—', 'â™˜', 'â™™', 'â™š', 'â™›', 'â™œ', 'â™', 'â™ž', 'â™Ÿ', 'â™ ', 'â™¡', 'â™¢', 'â™£', 'â™¤', 'â™¥', 'â™¦', 'â™§', 'â™¨', 'â™©', 'â™ª', 'â™«', 'â™¬', 'â™­', 'â™®', 'â™¯', 'â™°', 'â™±', 'â™²', 'â™³', 'â™´', 'â™µ', 'â™¶', 'â™·', 'â™¸', 'â™¹', 'â™º', 'â™»', 'â™¼', 'â™½', 'â™¾', 'â™¿', 'âš€', 'âš', 'âš‚', 'âšƒ', 'âš„', 'âš…', 'âš‡', 'âšˆ', 'âš‰', 'âšŠ', 'âš‹', 'âšŒ', 'âš', 'âšŽ', 'âš', 'âš', 'âš‘', 'âš’', 'âš“', 'âš”', 'âš•', 'âš–', 'âš—', 'âš˜', 'âš™', 'âšš', 'âš›', 'âšœ', 'âš', 'âšž', 'âšŸ', 'âš ', 'âš¡', 'âš¢', 'âš£', 'âš¤', 'âš¥', 'âš¦', 'âš§', 'âš¨', 'âš©', 'âšª', 'âš«', 'âš¬', 'âš­', 'âš®', 'âš¯', 'âš°', 'âš±', 'âš²', 'âš³', 'âš´', 'âšµ', 'âš¶', 'âš·', 'âš¸', 'âš¹', 'âšº', 'âš»', 'âš¼', 'âš½', 'âš¾', 'âš¿', 'â›€', 'â›', 'â›‚', 'â›ƒ', 'â›„', 'â›…', 'â›ˆ', 'â›Ž', 'â›', 'â›‘', 'â›“', 'â›”', 'â›©', 'â›ª', 'â›°', 'â›±', 'â›²', 'â›³', 'â›´', 'â›µ', 'â›·', 'â›¸', 'â›¹', 'â›º', 'â›½'
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(collected)));
  }, [collected]);

  useEffect(() => {
    if (!sceneRef.current) return;

    const { Engine, Render, Runner, Bodies, Composite, Mouse, MouseConstraint, Events } = Matter;
    const width = sceneRef.current.clientWidth;
    const height = sceneRef.current.clientHeight;
    
    const engine = Engine.create();
    engineRef.current = engine;
    engine.world.gravity.y = 0;

    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: width,
        height: height,
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
    const ground = Bodies.rectangle(width / 2, height + thickness / 2, width * 2, thickness, wallOptions);
    const wallLeft = Bodies.rectangle(-thickness / 2, height / 2, thickness, height * 2, wallOptions);
    const wallRight = Bodies.rectangle(width + thickness / 2, height / 2, thickness, height * 2, wallOptions);
    const ceiling = Bodies.rectangle(width / 2, -thickness / 2, width * 2, thickness, wallOptions);
    
    Composite.add(engine.world, [ground, wallLeft, wallRight, ceiling]);

    const pool = FULL_COLLECTION_SET.filter(c => !collected.has(c));
    const displayPool = pool.length > 0 ? pool : FULL_COLLECTION_SET;
    
    // Optimization: Use a smaller body size for physics and limit total bodies if needed
    // but here we want to show all. We'll optimize by using circles for simpler collision math.
    const initialChars = displayPool.map((char) => {
      const x = Math.random() * (width - 40) + 20;
      const y = Math.random() * (height - 40) + 20;
      const body = Bodies.circle(x, y, 8, {
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
      context.font = '16px "Helvetica Neue", Helvetica, Arial, sans-serif';
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

    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);

    return () => {
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

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col items-center font-mono" style={{ backgroundColor: bgColor, color: textColor }}>
      <div className="z-10 flex flex-col items-center w-full h-full px-4 pt-6 overflow-y-auto">
        <div className="w-full aspect-[4/3] relative overflow-hidden shrink-0 border border-current">
          <div ref={sceneRef} className="absolute inset-0 w-full h-full" style={{ touchAction: 'none' }} />
        </div>
        
        <div className="mt-4 flex flex-col items-center shrink-0">
          <div 
            onClick={() => result && handleCopy(result)}
            className="w-24 h-24 flex items-center justify-center border border-current bg-white/50 transition-colors relative active:bg-black/5"
          >
            <span className={`text-6xl ${isDispensing ? 'animate-pulse opacity-20' : ''}`} style={{ fontVariantEmoji: 'text', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
              {result ? result + '\uFE0E' : ''}
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
          <div className="mt-2 text-[10px] opacity-40 uppercase tracking-widest">Tap to copy</div>
        </div>

        <div className="flex flex-col gap-4 w-full mt-4 shrink-0">
          {dispenseVisible && (
            <button
              onTouchStart={dispense}
              disabled={isDispensing}
              className={`w-full py-4 border border-current font-bold tracking-widest transition-all flex items-center justify-center gap-2 ${isDispensing ? 'bg-black text-white' : 'active:bg-black active:text-white'}`}
              style={{ color: isDispensing ? '#FFFFFF' : dispenseColor, fontSize: `${dispenseSize}px` }}
            >
              {dispenseText}
            </button>
          )}
        </div>

        {historyVisible && (
          <div className="mt-6 w-full pb-10">
            <div className="flex items-center justify-between gap-2 mb-3 border-b border-current pb-1">
              <span style={{ color: historyColor, fontSize: `${historySize}px` }} className="uppercase font-bold tracking-widest">
                {historyLabel}
              </span>
              <span style={{ color: historyColor, fontSize: `${historySize}px` }} className="font-bold">
                [{collected.size}/{FULL_COLLECTION_SET.length}]
              </span>
            </div>
            <div className="grid grid-cols-8 gap-1 justify-items-center">
              {FULL_COLLECTION_SET.map((char, i) => {
                const isCollected = collected.has(char);
                return (
                  <div
                    key={i}
                    onClick={() => isCollected && handleCopy(char)}
                    className={`relative w-8 h-8 flex items-center justify-center border transition-all duration-300 ${
                      isCollected 
                        ? 'border-current opacity-100 scale-100 active:bg-black active:text-white' 
                        : 'border-current/10 opacity-20 scale-90 grayscale'
                    }`}
                    style={{ fontSize: '16px', fontVariantEmoji: 'text', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
                  >
                    {char + '\uFE0E'}
                  </div>
                );
              })}
            </div>
          </div>
        )}
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