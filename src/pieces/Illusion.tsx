import React, { useState, useEffect, useRef, useCallback } from 'react';
import { gizmoRuntime } from '@gizmo/runtime';
import { Play, RotateCcw, Eye, Info } from 'lucide-react';

const tweaks = gizmoRuntime.tweaks({
  backgroundColor: { index: 0, name: 'Background', type: 'color', value: '#FFDD46' },
  accentColor: { index: 1, name: 'Accent Color', type: 'color', value: "#FFFFFF" },
  dotColor: { index: 2, name: 'Center Dot', type: 'color', value: "#E93323" },
  timerDuration: { index: 3, name: 'Timer (s)', type: 'slider', value: 30.0, min: 10, max: 60, step: 1 },
  gridSpeed: { index: 4, name: 'Zoom Out Speed', type: 'slider', value: 3.3, min: 0.5, max: 10.0, step: 0.1 },
  gridScale: { index: 5, name: 'Zoom Out Scale', type: 'slider', value: 1.0, min: 0.5, max: 5.0, step: 0.1 },
  grid2Speed: { index: 6, name: 'Zoom In Speed', type: 'slider', value: 3.3, min: 0.5, max: 10.0, step: 0.1 },
  grid2Scale: { index: 7, name: 'Zoom In Scale', type: 'slider', value: 1.0, min: 0.5, max: 5.0, step: 0.1 },
  grid3Speed: { index: 8, name: 'Waves Speed', type: 'slider', value: 3.3, min: 0.5, max: 10.0, step: 0.1 },
  grid3Scale: { index: 9, name: 'Waves Scale', type: 'slider', value: 1.0, min: 0.5, max: 5.0, step: 0.1 },
  titleText: { index: 10, name: 'Title', type: 'text', value: 'REALITY BENDER', group: 'title' },
  titleColor: { index: 11, name: 'Title', type: 'color', value: '#000000', group: 'title' },
  titleSize: { index: 12, name: 'Title', type: 'slider', value: 48.0, min: 12, max: 64, step: 1, group: 'title' },
  titleVisible: { index: 13, name: 'Title', type: 'toggle', value: false, group: 'title' },
  instructionText: { index: 14, name: 'Instruction', type: 'text', value: "STARE AT THE RED DOT", group: 'instruction' },
  instructionColor: { index: 15, name: 'Instruction', type: 'color', value: '#000000', group: 'instruction' },
  instructionSize: { index: 16, name: 'Instruction', type: 'slider', value: 13.0, min: 12, max: 32, step: 1, group: 'instruction' },
  instructionVisible: { index: 17, name: 'Instruction', type: 'toggle', value: true, group: 'instruction' },
  lookAwayText: { index: 18, name: 'Look Away', type: 'text', value: 'NOW LOOK AROUND!', group: 'look-away' },
  lookAwayColor: { index: 19, name: 'Look Away', type: 'color', value: '#000000', group: 'look-away' },
  lookAwaySize: { index: 20, name: 'Look Away', type: 'slider', value: 48.0, min: 12, max: 48, step: 1, group: 'look-away' },
  lookAwayVisible: { index: 21, name: 'Look Away', type: 'toggle', value: true, group: 'look-away' },
  disclaimerText: { index: 22, name: 'Disclaimer', type: 'text', value: 'WARNING: THIS EXPERIENCE CONTAINS STRONG VISUAL PATTERNS THAT MAY TRIGGER SEIZURES FOR PEOPLE WITH PHOTOSENSITIVE EPILEPSY.', group: 'disclaimer' },
  disclaimerColor: { index: 23, name: 'Disclaimer', type: 'color', value: '#E93323', group: 'disclaimer' },
  disclaimerSize: { index: 24, name: 'Disclaimer', type: 'slider', value: 10, min: 8, max: 24, step: 1, group: 'disclaimer' },
  disclaimerVisible: { index: 25, name: 'Disclaimer', type: 'toggle', value: true, group: 'disclaimer' },
  selectPatternText: { index: 26, name: 'Select Pattern Label', type: 'text', value: 'SELECT PATTERN', group: 'select-pattern' },
  selectPatternColor: { index: 27, name: 'Select Pattern Label', type: 'color', value: '#FFFFFF', group: 'select-pattern' },
  selectPatternSize: { index: 28, name: 'Select Pattern Label', type: 'slider', value: 12, min: 8, max: 24, step: 1, group: 'select-pattern' },
  selectPatternVisible: { index: 29, name: 'Select Pattern Label', type: 'toggle', value: true, group: 'select-pattern' },
  pattern1Text: { index: 30, name: 'Pattern 1 Name', type: 'text', value: 'ZOOM OUT', group: 'pattern-1' },
  pattern1Color: { index: 31, name: 'Pattern 1 Name', type: 'color', value: '#000000', group: 'pattern-1' },
  pattern1Size: { index: 32, name: 'Pattern 1 Name', type: 'slider', value: 16, min: 8, max: 32, step: 1, group: 'pattern-1' },
  pattern1Visible: { index: 33, name: 'Pattern 1 Name', type: 'toggle', value: true, group: 'pattern-1' },
  pattern2Text: { index: 34, name: 'Pattern 2 Name', type: 'text', value: 'ZOOM IN', group: 'pattern-2' },
  pattern2Color: { index: 35, name: 'Pattern 2 Name', type: 'color', value: '#000000', group: 'pattern-2' },
  pattern2Size: { index: 36, name: 'Pattern 2 Name', type: 'slider', value: 16, min: 8, max: 32, step: 1, group: 'pattern-2' },
  pattern2Visible: { index: 37, name: 'Pattern 2 Name', type: 'toggle', value: true, group: 'pattern-2' },
  pattern3Text: { index: 38, name: 'Pattern 3 Name', type: 'text', value: 'WAVES', group: 'pattern-3' },
  pattern3Color: { index: 39, name: 'Pattern 3 Name', type: 'color', value: '#000000', group: 'pattern-3' },
  pattern3Size: { index: 40, name: 'Pattern 3 Name', type: 'slider', value: 16, min: 8, max: 32, step: 1, group: 'pattern-3' },
  pattern3Visible: { index: 41, name: 'Pattern 3 Name', type: 'toggle', value: true, group: 'pattern-3' },
  beginBtnText: { index: 42, name: 'Begin Button', type: 'text', value: 'BEGIN', group: 'begin-btn' },
  beginBtnColor: { index: 43, name: 'Begin Button', type: 'color', value: '#000000', group: 'begin-btn' },
  beginBtnSize: { index: 44, name: 'Begin Button', type: 'slider', value: 19.0, min: 12, max: 48, step: 1, group: 'begin-btn' },
  beginBtnVisible: { index: 45, name: 'Begin Button', type: 'toggle', value: true, group: 'begin-btn' },
  tryAgainBtnText: { index: 46, name: 'Try Again Button', type: 'text', value: 'TRY AGAIN', group: 'try-again-btn' },
  tryAgainBtnColor: { index: 47, name: 'Try Again Button', type: 'color', value: '#000000', group: 'try-again-btn' },
  tryAgainBtnSize: { index: 48, name: 'Try Again Button', type: 'slider', value: 16, min: 12, max: 32, step: 1, group: 'try-again-btn' },
  tryAgainBtnVisible: { index: 49, name: 'Try Again Button', type: 'toggle', value: true, group: 'try-again-btn' },
  overlayOpacity: { index: 50, name: 'Overlay Opacity', type: 'slider', value: 0.08, min: 0, max: 0.3, step: 0.01 },
  menuScale: { index: 51, name: 'Menu Size', type: 'slider', value: 0.95000005, min: 0.5, max: 1.5, step: 0.05 },
  menuVerticalOffset: { index: 52, name: 'Menu Vertical Position', type: 'slider', value: -25.0, min: -200, max: 200, step: 5 },
});

const VS_SOURCE = `
  attribute vec4 a_position;
  void main() {
    gl_Position = a_position;
  }
`;

const FS_SOURCE = `
  precision highp float;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_speed;
  uniform float u_scale;
  uniform int u_mode;
  uniform vec3 u_accent_color;

  #define PI 3.14159265359

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.y, u_resolution.x);
    uv *= 10.0 * u_scale;
    
    float r = length(uv);
    float a = atan(uv.y, uv.x);
    
    // Checkerboard Warp
    vec2 p = vec2(r, a);
    
    float color = 0.0;
    if (u_mode == 0) {
      // Standard Grid Warp
      p.x -= u_time * u_speed * 0.5;
      color = sin(p.x * 10.0) * sin(p.y * 8.0);
    } else if (u_mode == 1) {
      // Reversed Grid Warp
      p.x += u_time * u_speed * 0.5;
      color = sin(p.x * 10.0) * sin(p.y * 8.0);
    } else {
      // Alternating Segments
      float segment = floor(p.y * 8.0 / PI);
      if (mod(segment, 2.0) == 0.0) {
        p.x -= u_time * u_speed * 0.5;
      } else {
        p.x += u_time * u_speed * 0.5;
      }
      color = sin(p.x * 10.0) * sin(p.y * 8.0);
    }
    
    color = step(0.0, color);
    vec3 finalColor = mix(vec3(0.0), u_accent_color, color);
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export default function Component() {
  const [gameState, setGameState] = useState<'menu' | 'active' | 'finished'>('menu');
  const [activePattern, setActivePattern] = useState<0 | 1 | 2>(0);
  const [timeLeft, setTimeLeft] = useState(30);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const backgroundColor = tweaks.backgroundColor.useState();
  const accentColor = tweaks.accentColor.useState();
  const dotColor = tweaks.dotColor.useState();
  const timerDuration = tweaks.timerDuration.useState();
  
  const gridSpeed = tweaks.gridSpeed.useState();
  const gridScale = tweaks.gridScale.useState();
  const grid2Speed = tweaks.grid2Speed.useState();
  const grid2Scale = tweaks.grid2Scale.useState();
  const grid3Speed = tweaks.grid3Speed.useState();
  const grid3Scale = tweaks.grid3Scale.useState();
  
  const titleText = tweaks.titleText.useState();
  const titleColor = tweaks.titleColor.useState();
  const titleSize = tweaks.titleSize.useState();
  const titleVisible = tweaks.titleVisible.useState();
  
  const instructionText = tweaks.instructionText.useState();
  const instructionColor = tweaks.instructionColor.useState();
  const instructionSize = tweaks.instructionSize.useState();
  const instructionVisible = tweaks.instructionVisible.useState();
  
  const lookAwayText = tweaks.lookAwayText.useState();
  const lookAwayColor = tweaks.lookAwayColor.useState();
  const lookAwaySize = tweaks.lookAwaySize.useState();
  const lookAwayVisible = tweaks.lookAwayVisible.useState();

  const disclaimerText = tweaks.disclaimerText.useState();
  const disclaimerColor = tweaks.disclaimerColor.useState();
  const disclaimerSize = tweaks.disclaimerSize.useState();
  const disclaimerVisible = tweaks.disclaimerVisible.useState();

  const selectPatternText = tweaks.selectPatternText.useState();
  const selectPatternColor = tweaks.selectPatternColor.useState();
  const selectPatternSize = tweaks.selectPatternSize.useState();
  const selectPatternVisible = tweaks.selectPatternVisible.useState();

  const pattern1Text = tweaks.pattern1Text.useState();
  const pattern1Color = tweaks.pattern1Color.useState();
  const pattern1Size = tweaks.pattern1Size.useState();
  const pattern1Visible = tweaks.pattern1Visible.useState();

  const pattern2Text = tweaks.pattern2Text.useState();
  const pattern2Color = tweaks.pattern2Color.useState();
  const pattern2Size = tweaks.pattern2Size.useState();
  const pattern2Visible = tweaks.pattern2Visible.useState();

  const pattern3Text = tweaks.pattern3Text.useState();
  const pattern3Color = tweaks.pattern3Color.useState();
  const pattern3Size = tweaks.pattern3Size.useState();
  const pattern3Visible = tweaks.pattern3Visible.useState();

  const beginBtnText = tweaks.beginBtnText.useState();
  const beginBtnColor = tweaks.beginBtnColor.useState();
  const beginBtnSize = tweaks.beginBtnSize.useState();
  const beginBtnVisible = tweaks.beginBtnVisible.useState();

  const tryAgainBtnText = tweaks.tryAgainBtnText.useState();
  const tryAgainBtnColor = tweaks.tryAgainBtnColor.useState();
  const tryAgainBtnSize = tweaks.tryAgainBtnSize.useState();
  const tryAgainBtnVisible = tweaks.tryAgainBtnVisible.useState();
  const overlayOpacity = tweaks.overlayOpacity.useState();
  const menuScale = tweaks.menuScale.useState();
  const menuVerticalOffset = tweaks.menuVerticalOffset.useState();

  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
  };

  const initGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;
    glRef.current = gl;

    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const vs = createShader(gl.VERTEX_SHADER, VS_SOURCE);
    const fs = createShader(gl.FRAGMENT_SHADER, FS_SOURCE);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    programRef.current = program;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    
    const pos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  }, []);

  const render = useCallback((time: number) => {
    const gl = glRef.current;
    const program = programRef.current;
    if (!gl || !program) return;

    gl.useProgram(program);
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), gl.canvas.width, gl.canvas.height);
    gl.uniform1f(gl.getUniformLocation(program, 'u_time'), (time - startTimeRef.current) * 0.001);
    
    let currentSpeed = gridSpeed;
    let currentScale = gridScale;
    if (activePattern === 1) {
      currentSpeed = grid2Speed;
      currentScale = grid2Scale;
    } else if (activePattern === 2) {
      currentSpeed = grid3Speed;
      currentScale = grid3Scale;
    }

    gl.uniform1f(gl.getUniformLocation(program, 'u_speed'), currentSpeed);
    gl.uniform1f(gl.getUniformLocation(program, 'u_scale'), currentScale);
    gl.uniform1i(gl.getUniformLocation(program, 'u_mode'), activePattern);
    
    const rgb = hexToRgb(accentColor);
    gl.uniform3f(gl.getUniformLocation(program, 'u_accent_color'), rgb[0], rgb[1], rgb[2]);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    rafRef.current = requestAnimationFrame(render);
  }, [gridSpeed, gridScale, grid2Speed, grid2Scale, grid3Speed, grid3Scale, accentColor, activePattern]);

  useEffect(() => {
    initGL();
    if (gameState === 'menu' || gameState === 'active') {
      startTimeRef.current = performance.now();
      rafRef.current = requestAnimationFrame(render);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [initGL, gameState, render]);

  useEffect(() => {
    if (gameState === 'active') {
      setTimeLeft(timerDuration);
      
      const interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setGameState('finished');
            gizmoRuntime.performHaptic('heavy');
            return 0;
          }
          if (prev <= 5) gizmoRuntime.performHaptic('light');
          return prev - 1;
        });
      }, 1000);
      
      return () => {
        clearInterval(interval);
      };
    }
  }, [gameState, timerDuration]);

  const startExperience = () => {
    gizmoRuntime.performHaptic('medium');
    setGameState('active');
  };

  const resetExperience = () => {
    gizmoRuntime.performHaptic('soft');
    setGameState('menu');
  };

  return (
    <div className="h-screen w-screen overflow-hidden relative font-mono" style={{ backgroundColor }}>
      <canvas
        ref={canvasRef}
        width={window.innerWidth * 2}
        height={window.innerHeight * 2}
        className="absolute inset-0 w-full h-full"
        style={{ 
          display: gameState === 'finished' ? 'none' : 'block',
          opacity: gameState === 'menu' ? overlayOpacity : 1
        }}
      />

      {/* UI Overlay */}
      <div className="relative z-10 h-full w-full flex flex-col items-center p-6 pointer-events-none">
        
        {/* Header / Active State Info */}
        <div className={`text-center w-full ${gameState === 'menu' ? 'mt-4 mb-4' : 'absolute top-12 left-0 right-0'}`}>
          {titleVisible && gameState === 'menu' && (
            <div className="inline-block bg-white border-4 border-black p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transform -rotate-2">
              <h1 style={{ color: titleColor, fontSize: `${titleSize}px` }} className="font-black uppercase tracking-tighter leading-none">
                {titleText}
              </h1>
            </div>
          )}
          {gameState === 'active' && (
            <div className="flex flex-col items-center animate-in fade-in slide-in-from-top duration-500">
              <div className="mb-2">
                <div className="text-7xl font-black text-white tabular-nums">
                  {timeLeft}
                </div>
              </div>
              {instructionVisible && (
                <div className="px-6 py-2">
                  <p style={{ color: '#FFFFFF', fontSize: `${instructionSize}px` }} className="font-bold uppercase tracking-widest">
                    {instructionText}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col items-center justify-center w-full">
          {/* Center Dot */}
          {gameState === 'active' && (
            <div 
              className="w-4 h-4 rounded-full z-20 pointer-events-none shadow-[0_0_15px_rgba(0,0,0,0.5)] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ backgroundColor: dotColor }}
            />
          )}

          {/* Menu State */}
          {gameState === 'menu' && (
            <div 
              className="w-full max-w-xs flex flex-col gap-6 pointer-events-auto animate-in fade-in zoom-in duration-300"
              style={{ 
                transform: `translateY(${menuVerticalOffset}px) scale(${menuScale})`,
                transformOrigin: 'center center'
              }}
            >
              <div className="bg-white border-4 border-black p-6 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
                {/* Subtle inner card pattern */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
                
                <div className="relative z-10 text-center mb-4">
                  {selectPatternVisible && (
                    <span 
                      style={{ color: selectPatternColor, fontSize: `${selectPatternSize}px` }} 
                      className="bg-black px-2 py-1 font-bold uppercase tracking-widest inline-block mb-4"
                    >
                      {selectPatternText}
                    </span>
                  )}
                  <div className="flex flex-col gap-3">
                    {[
                      { id: 0, text: pattern1Text, color: pattern1Color, size: pattern1Size, visible: pattern1Visible },
                      { id: 1, text: pattern2Text, color: pattern2Color, size: pattern2Size, visible: pattern2Visible },
                      { id: 2, text: pattern3Text, color: pattern3Color, size: pattern3Size, visible: pattern3Visible }
                    ].map((p) => p.visible && (
                      <button
                        key={p.id}
                        onClick={() => {
                          setActivePattern(p.id as 0 | 1 | 2);
                          gizmoRuntime.performHaptic('light');
                        }}
                        className={`py-3 px-4 border-4 border-black font-black uppercase transition-all transform active:translate-x-1 active:translate-y-1 active:shadow-none ${
                          activePattern === p.id 
                            ? 'bg-[#53B5F9] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -translate-y-1 -translate-x-1' 
                            : 'bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                        }`}
                      >
                        <span style={{ color: p.color, fontSize: `${p.size}px` }}>{p.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-start gap-3 text-black font-bold leading-tight mt-6 border-t-4 border-black pt-4">
                  <Info size={20} strokeWidth={3} className="shrink-0" />
                  <p className="uppercase" style={{ fontSize: `${instructionSize}px`, color: instructionColor }}>Stare at the red dot for {timerDuration} seconds. Then look around!</p>
                </div>

                {disclaimerVisible && (
                  <div className="mt-4 pt-4 border-t-2 border-black border-dashed">
                    <p 
                      style={{ color: disclaimerColor, fontSize: `${disclaimerSize}px` }} 
                      className="font-black leading-tight uppercase"
                    >
                      {disclaimerText}
                    </p>
                  </div>
                )}
              </div>

              {beginBtnVisible && (
                <button
                  onClick={startExperience}
                  className="w-full py-6 border-4 border-black font-black uppercase tracking-widest flex items-center justify-center gap-3 transform hover:-translate-y-1 hover:-translate-x-1 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
                  style={{ backgroundColor: accentColor, color: beginBtnColor, fontSize: `${beginBtnSize}px` }}
                >
                  <Play fill="currentColor" size={beginBtnSize + 4} />
                  {beginBtnText}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Finished State */}
        {gameState === 'finished' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-[#E432B7] pointer-events-auto">
            <div className="bg-white border-8 border-black p-8 shadow-[20px_20px_0px_0px_rgba(0,0,0,1)] text-center transform rotate-2">
              <div className="bg-black inline-block p-4 mb-6">
                <Eye size={80} color="#FFFFFF" strokeWidth={3} />
              </div>
              {lookAwayVisible && (
                <h2 
                  style={{ color: lookAwayColor, fontSize: `${lookAwaySize}px` }} 
                  className="font-black uppercase tracking-tighter leading-tight mb-8"
                >
                  {lookAwayText}
                </h2>
              )}
              
              {tryAgainBtnVisible && (
                <button
                  onClick={resetExperience}
                  className="w-full px-8 py-4 border-4 border-black bg-[#75F94C] font-black uppercase flex items-center justify-center gap-2 transform hover:-translate-y-1 hover:-translate-x-1 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
                  style={{ color: tryAgainBtnColor, fontSize: `${tryAgainBtnSize}px` }}
                >
                  <RotateCcw size={tryAgainBtnSize + 8} strokeWidth={3} />
                  {tryAgainBtnText}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer Spacer */}
        <div className="mb-4" />
      </div>
    </div>
  );
}