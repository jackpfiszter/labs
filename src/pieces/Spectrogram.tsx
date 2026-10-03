import React, { useRef, useEffect, useState, useCallback } from 'react';
import { gizmoRuntime } from '@gizmo/runtime';
import { Mic, MicOff } from 'lucide-react';

const tweaks = gizmoRuntime.tweaks({
  lowColor: { index: 0, name: 'Background & Low Intensity', type: 'color', value: "#000000" },
  lowMidColor: { index: 1, name: 'Low-Mid Intensity', type: 'color', value: "#4200FF" },
  midColor: { index: 2, name: 'Mid Intensity', type: 'color', value: '#E432B7' },
  highColor: { index: 3, name: 'High Intensity', type: 'color', value: '#FFDD46' },
  scrollSpeed: { index: 4, name: 'Scroll Speed', type: 'slider', value: 1.0, min: 1, max: 10, step: 1 },
  sensitivity: { index: 5, name: 'Sensitivity', type: 'slider', value: 2.0, min: 0.1, max: 3, step: 0.1 },
  transientSuppression: { index: 6, name: 'Transient Suppression', type: 'slider', value: 0.0, min: 0, max: 1, step: 0.05 },
  fftSize: { index: 7, name: 'FFT Size (Resolution)', type: 'slider', value: 32768.0, min: 512, max: 32768, step: 512 },
  logScale: { index: 8, name: 'Logarithmic Scale', type: 'toggle', value: true },
  smoothing: { index: 9, name: 'Smoothing', type: 'slider', value: 0.95, min: 0, max: 0.95, step: 0.05 },
  interpolation: { index: 10, name: 'Smooth Interpolation', type: 'toggle', value: true },
  minDecibels: { index: 11, name: 'Min Decibels', type: 'slider', value: -120.0, min: -120, max: -60, step: 5 },
  maxDecibels: { index: 12, name: 'Max Decibels', type: 'slider', value: 0.0, min: -50, max: 0, step: 5 },
  promptText: { index: 13, name: 'Prompt Text', type: 'text', value: 'SAY "AHH"', group: 'prompt' },
  promptColor: { index: 14, name: 'Prompt Color', type: 'color', value: '#FFDD46', group: 'prompt' },
  promptSize: { index: 15, name: 'Prompt Size', type: 'slider', value: 79.0, min: 20, max: 100, step: 1, group: 'prompt' },
  promptPosition: { index: 16, name: 'Prompt Position', type: 'slider', value: 0.0, min: 0, max: 100, step: 1, group: 'prompt' },
  promptVisible: { index: 17, name: 'Show Prompt', type: 'toggle', value: true, group: 'prompt' },
  overtonesText: { index: 18, name: 'Overtones Text', type: 'text', value: "test", group: 'overtones' },
  overtonesColor: { index: 19, name: 'Overtones Color', type: 'color', value: '#FFFFFF', group: 'overtones' },
  overtonesSize: { index: 20, name: 'Overtones Size', type: 'slider', value: 14, min: 8, max: 24, step: 1, group: 'overtones' },
  overtonesVisible: { index: 21, name: 'Show Overtones', type: 'toggle', value: false, group: 'overtones' },
});

export default function Component() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const prevDataArrayRef = useRef<Uint8Array | null>(null);
  const colorCacheRef = useRef<Map<number, string>>(new Map());

  const [isListening, setIsListening] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dprRef = useRef(1);
  const mountedRef = useRef(true);
  const isCoarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

  const lowColor = tweaks.lowColor.useState();
  const lowMidColor = tweaks.lowMidColor.useState();
  const backgroundColor = lowColor;
  const midColor = tweaks.midColor.useState();
  const highColor = tweaks.highColor.useState();
  const scrollSpeed = tweaks.scrollSpeed.useState();
  const sensitivity = tweaks.sensitivity.useState();
  const transientSuppression = tweaks.transientSuppression.useState();
  
  const fftSize = tweaks.fftSize.useState();
  const logScale = tweaks.logScale.useState();
  const smoothing = tweaks.smoothing.useState();
  const interpolation = tweaks.interpolation.useState();
  const minDecibels = tweaks.minDecibels.useState();
  const maxDecibels = tweaks.maxDecibels.useState();
  
  const promptText = tweaks.promptText.useState();
  const promptColor = tweaks.promptColor.useState();
  const promptSize = tweaks.promptSize.useState();
  const promptPosition = tweaks.promptPosition.useState();
  const promptVisible = tweaks.promptVisible.useState();

  const overtonesText = tweaks.overtonesText.useState();
  const overtonesColor = tweaks.overtonesColor.useState();
  const overtonesSize = tweaks.overtonesSize.useState();
  const overtonesVisible = tweaks.overtonesVisible.useState();

  const stopMic = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close();
      audioContextRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Called from the start button's click, so the AudioContext is created inside the user gesture.
  const startMic = async () => {
    if (isStarting) return;
    setError(null);
    setIsStarting(true);
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    const context: AudioContext = new AudioContextClass();
    audioContextRef.current = context;
    context.resume().catch(() => {});
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia unsupported');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;

      const analyser = context.createAnalyser();
      analyser.fftSize = Math.pow(2, Math.round(Math.log2(fftSize))); 
      analyser.smoothingTimeConstant = smoothing;
      analyser.minDecibels = minDecibels;
      analyser.maxDecibels = maxDecibels;
      analyserRef.current = analyser;

      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      await context.resume().catch(() => {});

      setIsListening(true);
      gizmoRuntime.performHaptic('medium');
    } catch (err: any) {
      console.error('Mic access denied:', err);
      stopMic();
      setError(err?.name === 'NotAllowedError' || err?.name === 'SecurityError'
        ? 'Microphone access denied. Allow it in your browser or device settings, then try again.'
        : 'No microphone available.');
    } finally {
      if (mountedRef.current) setIsStarting(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopMic();
    };
  }, []);

  const getHeatMapColor = (value: number) => {
    const cacheKey = Math.round(value * 10) / 10;
    if (colorCacheRef.current.has(cacheKey)) return colorCacheRef.current.get(cacheKey)!;

    const normalized = (value / 255) * sensitivity;
    const t = Math.min(1, Math.max(0, normalized));

    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b];
    };

    const cLow = hexToRgb(lowColor);
    const cLowMid = hexToRgb(lowMidColor);
    const cMid = hexToRgb(midColor);
    const cHigh = hexToRgb(highColor);

    let r, g, b;
    if (t < 0.25) {
      const factor = t * 4;
      r = Math.round(cLow[0] + (cLowMid[0] - cLow[0]) * factor);
      g = Math.round(cLow[1] + (cLowMid[1] - cLow[1]) * factor);
      b = Math.round(cLow[2] + (cLowMid[2] - cLow[2]) * factor);
    } else if (t < 0.5) {
      const factor = (t - 0.25) * 4;
      r = Math.round(cLowMid[0] + (cMid[0] - cLowMid[0]) * factor);
      g = Math.round(cLowMid[1] + (cMid[1] - cLowMid[1]) * factor);
      b = Math.round(cLowMid[2] + (cMid[2] - cLowMid[2]) * factor);
    } else {
      const factor = (t - 0.5) * 2;
      r = Math.round(cMid[0] + (cHigh[0] - cMid[0]) * factor);
      g = Math.round(cMid[1] + (cHigh[1] - cMid[1]) * factor);
      b = Math.round(cMid[2] + (cHigh[2] - cMid[2]) * factor);
    }

    const color = `rgb(${r},${g},${b})`;
    colorCacheRef.current.set(cacheKey, color);
    return color;
  };

  useEffect(() => {
    colorCacheRef.current.clear();
  }, [lowColor, lowMidColor, midColor, highColor, sensitivity]);

  useEffect(() => {
    if (!isListening || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
      offscreenCanvasRef.current.width = canvas.width;
      offscreenCanvasRef.current.height = canvas.height;
      const offCtx = offscreenCanvasRef.current.getContext('2d', { alpha: false });
      if (offCtx) {
        offCtx.fillStyle = backgroundColor;
        offCtx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

    const offCanvas = offscreenCanvasRef.current;
    const offCtx = offCanvas.getContext('2d', { alpha: false });
    if (!offCtx) return;

    const analyser = analyserRef.current;
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    if (!prevDataArrayRef.current || prevDataArrayRef.current.length !== bufferLength) {
      prevDataArrayRef.current = new Uint8Array(bufferLength);
    }
    const prevDataArray = prevDataArrayRef.current;

    const render = () => {
      if (!analyserRef.current || !offCtx || !ctx || document.visibilityState !== 'visible') {
        rafRef.current = requestAnimationFrame(render);
        return;
      }
      const analyser = analyserRef.current;
      
      analyser.smoothingTimeConstant = smoothing;
      analyser.minDecibels = minDecibels;
      analyser.maxDecibels = maxDecibels;

      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      const step = Math.max(1, Math.round(scrollSpeed * dprRef.current)); // scroll speed in CSS px

      offCtx.drawImage(offCanvas, step, 0, width - step, height, 0, 0, width - step, height);

      const sampleRate = audioContextRef.current?.sampleRate || 44100;
      const minFreq = 20;
      const maxFreq = sampleRate / 2;
      const logMaxMin = Math.log(maxFreq / minFreq);
      const threshold = 10 / sensitivity;

      for (let y = 0; y < height; y++) {
        let value = 0;
        
        if (logScale) {
          const percent = 1 - (y / height);
          const freq = minFreq * Math.exp(logMaxMin * percent);
          const binFloat = freq * bufferLength / (sampleRate / 2);
          const bin = Math.floor(binFloat);
          
          if (interpolation && bin < bufferLength - 1) {
            const fract = binFloat - bin;
            value = dataArray[bin] * (1 - fract) + dataArray[bin + 1] * fract;
            
            if (transientSuppression > 0) {
              const prevValue = prevDataArray[bin] * (1 - fract) + prevDataArray[bin + 1] * fract;
              if (value > prevValue + 40) {
                value = prevValue + (value - prevValue) * (1 - transientSuppression);
              }
            }
          } else {
            value = dataArray[bin] || 0;
          }
        } else {
          const i = Math.floor(((height - y) / height) * bufferLength);
          value = dataArray[i] || 0;
        }

        if (value > threshold) {
          offCtx.fillStyle = getHeatMapColor(value);
        } else {
          offCtx.fillStyle = backgroundColor;
        }
        offCtx.fillRect(width - step, y, step, 1);
      }

      prevDataArray.set(dataArray);
      ctx.drawImage(offCanvas, 0, 0);
      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isListening, backgroundColor, lowColor, lowMidColor, midColor, highColor, scrollSpeed, sensitivity, fftSize, logScale, smoothing, minDecibels, maxDecibels, interpolation]);

  // Canvas follows the piece's own box (not the window) at devicePixelRatio,
  // keeping what's already been drawn when it resizes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { width: cssWidth, height: cssHeight } = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(cssWidth * dpr));
      const height = Math.max(1, Math.round(cssHeight * dpr));
      if (canvas.width === width && canvas.height === height) return;
      dprRef.current = dpr;
      canvas.width = width;
      canvas.height = height;
      const off = offscreenCanvasRef.current;
      if (off) {
        const copy = document.createElement('canvas');
        copy.width = off.width;
        copy.height = off.height;
        copy.getContext('2d')?.drawImage(off, 0, 0);
        off.width = width;
        off.height = height;
        const offCtx = off.getContext('2d', { alpha: false });
        if (offCtx) {
          offCtx.fillStyle = backgroundColor;
          offCtx.fillRect(0, 0, width, height);
          offCtx.drawImage(copy, 0, 0, copy.width, copy.height, 0, 0, width, height);
        }
      }
      const ctx = canvas.getContext('2d', { alpha: false });
      if (ctx) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
        if (off) ctx.drawImage(off, 0, 0);
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="h-screen w-screen overflow-hidden relative font-sans" style={{ backgroundColor }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      <div className="absolute inset-0 flex flex-col pointer-events-none p-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
        {promptVisible && (
          <div 
            className="absolute left-0 right-0 flex justify-center z-10"
            style={{ top: `calc(${promptPosition}% + env(safe-area-inset-top))` }}
          >
            <h2 
              className="font-black tracking-tighter text-center uppercase"
              style={{ 
                color: promptColor, 
                fontSize: `min(${promptSize}px, 19vw)`,
                textShadow: '0 4px 12px rgba(0,0,0,0.5)'
              }}
            >
              {promptText}
            </h2>
          </div>
        )}

        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          {error && (
            <div className="max-w-sm p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm text-center">
              {error}
            </div>
          )}
          {!isListening && (
            <button
              onClick={startMic}
              disabled={isStarting}
              className="pointer-events-auto flex items-center gap-2 min-h-[44px] px-6 py-3 rounded-full border-2 font-bold uppercase tracking-wide text-sm md:text-base cursor-pointer transition-opacity [@media(hover:hover)]:hover:opacity-80 disabled:opacity-50"
              style={{ color: promptColor, borderColor: promptColor }}
            >
              {error ? <MicOff size={20} /> : <Mic size={20} />}
              {error ? 'Try again' : `${isCoarse ? 'Tap' : 'Click'} to start microphone`}
            </button>
          )}
        </div>

        {overtonesVisible && (
          <div className="absolute bottom-8 right-6 w-1/2 max-w-[180px] z-30">
            <p 
              className="text-left leading-tight opacity-90"
              style={{ 
                color: overtonesColor, 
                fontSize: `${overtonesSize}px`,
                textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                userSelect: 'text'
              }}
            >
              {overtonesText}
            </p>
          </div>
        )}
      </div>

      {isListening && (
        <div className="absolute left-[max(0.5rem,env(safe-area-inset-left))] inset-y-0 flex flex-col pointer-events-none z-20">
          <div className="relative h-full w-12 text-[10px] md:text-xs font-bold" style={{ color: promptColor }}>
            {(() => {
              const sampleRate = 44100;
              const minFreq = 20;
              const maxFreq = sampleRate / 2;
              const logMaxMin = Math.log(maxFreq / minFreq);

              const getPos = (freq: number) => {
                const percent = Math.log(freq / minFreq) / logMaxMin;
                return (1 - percent) * 100;
              };

              const labels = [5000, 3000, 2000, 1000, 500, 300, 200, 100, 50];

              return (
                <>
                  {labels.map((freq) => {
                    const top = getPos(freq);
                    if (top < 0 || top > 100) return null;
                    return (
                      <div 
                        key={freq}
                        className="absolute flex items-center whitespace-nowrap" 
                        style={{ top: `${top}%`, transform: 'translateY(-50%)' }}
                      >
                        <span>{`${freq}Hz`}</span>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}