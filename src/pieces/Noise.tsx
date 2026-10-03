import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as Tone from 'tone';
import { gizmoRuntime } from '@gizmo/runtime';

const tweaks = gizmoRuntime.tweaks({
  mainColor: { index: 0, name: 'Main Color', type: 'color', value: "#F9F94C", group: "Colors" },
  backgroundColor: { index: 1, name: 'Background', type: 'color', value: "#1A1909", group: "Colors" },
  textColor: { index: 2, name: 'Text', type: 'color', value: '#FFFFFF', group: "Colors" },
  glowStrength: { index: 3, name: 'Glow Strength', type: 'slider', value: 7.0, min: 0, max: 20, step: 1, group: "Colors" },
  minFreq: { index: 4, name: 'Min Frequency', type: 'slider', value: 1.0, min: 1, max: 100, step: 1 },
  maxFreq: { index: 5, name: 'Max Frequency', type: 'slider', value: 22000.0, min: 5000, max: 22000, step: 100 },
  lineWidth: { index: 6, name: 'Line Width', type: 'slider', value: 5.0, min: 1, max: 5, step: 0.5 },
  weirdness: { index: 7, name: 'Weirdness', type: 'slider', value: 0.0, min: 0, max: 1, step: 0.01 },
});

const WAVE_TYPES: Tone.ToneOscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];

const MIN_SLIDER = 0;
const MAX_SLIDER = 1000;

const INTERESTING_FREQUENCIES = [
  { freq: 20, label: "20 Hz", description: "Approximate lower limit of human hearing." },
  { freq: 60, label: "60 Hz", description: "Typical hum of electrical systems." },
  { freq: 250, label: "250 Hz", description: "Common frequency for male voices." },
  { freq: 440, label: "A4 (440 Hz)", description: "Standard tuning pitch for orchestras." },
  { freq: 1000, label: "1 kHz", description: "Reference frequency for audio testing." },
  { freq: 2000, label: "2 kHz", description: "Key for speech intelligibility." },
  { freq: 4000, label: "4 kHz", description: "Area of greatest human hearing sensitivity." },
  { freq: 8000, label: "8 kHz", description: "High-frequency sibilance in speech." },
  { freq: 17400, label: "17.4 kHz", description: "The 'Mosquito' tone, often inaudible to adults." },
  { freq: 20000, label: "20 kHz", description: "Approximate upper limit of human hearing." },
];

// This is a simple way to inject a font link into the document head.
// In a real Gizmo environment, this might be handled differently.
const DigitalFontLoader = () => {
  useEffect(() => {
    const link = document.createElement('link');
    link.href = "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);
  return null;
};

export default function Component() {
  const mainColor = tweaks.mainColor.useState();
  const backgroundColor = tweaks.backgroundColor.useState();
  const textColor = tweaks.textColor.useState();
  const glowStrength = tweaks.glowStrength.useState();
  const minFreq = tweaks.minFreq.useState();
  const maxFreq = tweaks.maxFreq.useState();
  const lineWidth = tweaks.lineWidth.useState();
  const weirdness = tweaks.weirdness.useState();

  const [isStarted, setIsStarted] = useState(false);
  const [frequency, setFrequency] = useState(20);
  const [waveTypeIndex, setWaveTypeIndex] = useState(0);
  const [activeInfo, setActiveInfo] = useState<{ label: string; description: string } | null>(null);

  const audioNodes = useRef<{ osc: Tone.Oscillator; analyser: Tone.Analyser } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();
  const sliderRef = useRef<HTMLDivElement>(null);

  const sliderToFreq = useCallback((sliderVal: number) => {
    if (maxFreq <= minFreq) return minFreq;
    const logValue = (sliderVal - MIN_SLIDER) / (MAX_SLIDER - MIN_SLIDER);
    return minFreq * Math.pow(maxFreq / minFreq, logValue);
  }, [minFreq, maxFreq]);

  const freqToSlider = useCallback((freq: number) => {
    if (maxFreq <= minFreq || freq <= minFreq) return MIN_SLIDER;
    const logRatio = Math.log(freq / minFreq) / Math.log(maxFreq / minFreq);
    return MIN_SLIDER + logRatio * (MAX_SLIDER - MIN_SLIDER);
  }, [minFreq, maxFreq]);

  useEffect(() => {
    let infoTimeout: NodeJS.Timeout;
    const nearbyFreq = INTERESTING_FREQUENCIES.find(
      (point) => Math.abs(frequency - point.freq) < (point.freq * 0.08) // 8% tolerance
    );

    if (nearbyFreq) {
      setActiveInfo({ label: nearbyFreq.label, description: nearbyFreq.description });
      infoTimeout = setTimeout(() => setActiveInfo(null), 3000);
    } else {
      setActiveInfo(null);
    }
    return () => clearTimeout(infoTimeout);
  }, [frequency]);

  useEffect(() => {
    const initAudio = async () => {
      try {
        await Tone.start();
        const osc = new Tone.Oscillator({
          type: WAVE_TYPES[waveTypeIndex],
          frequency: 440,
        }).toDestination();
        const analyser = new Tone.Analyser('waveform', 1024);
        osc.connect(analyser);
        osc.start();
        audioNodes.current = { osc, analyser };
        setIsStarted(true);
        gizmoRuntime.performHaptic('light');
      } catch (error) {
        console.error("Error creating audio nodes:", error);
      }
    };

    initAudio();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      audioNodes.current?.osc.stop();
      audioNodes.current?.osc.dispose();
      audioNodes.current?.analyser.dispose();
    };
  }, []);

  useEffect(() => {
    if (isStarted && audioNodes.current) {
      audioNodes.current.osc.frequency.rampTo(frequency, 0.02);
    }
  }, [frequency, isStarted]);

  useEffect(() => {
    if (isStarted && audioNodes.current) {
      audioNodes.current.osc.type = WAVE_TYPES[waveTypeIndex];
    }
  }, [waveTypeIndex, isStarted]);

  const draw = useCallback(() => {
    if (!canvasRef.current || !audioNodes.current?.analyser) {
      animationFrameId.current = requestAnimationFrame(draw);
      return;
    }
    const analyser = audioNodes.current.analyser;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    const values = analyser.getValue();
    const { width, height } = canvas;
    
    context.clearRect(0, 0, width, height);
    context.beginPath();
    context.lineWidth = lineWidth;
    context.strokeStyle = mainColor;
    context.shadowColor = mainColor;
    context.shadowBlur = glowStrength;
    const scaleFactor = 0.8; // Decrease scale slightly

    for (let i = 0; i < values.length; i++) {
      const x = (i / (values.length - 1)) * width;
      const v = Number(values[i]);
      // Introduce "weirdness"
      const weirdFactor = 1 + Math.sin(i * 0.1 + performance.now() * 0.001) * weirdness;
      // Shift the wave up so 0 amplitude sits in the middle of the space above the slider
      // Shifted up slightly to make space for info box
      const y = (v * weirdFactor * scaleFactor * 0.7) * (height / 2) + (height / 2) - (height * 0.1);

      if (i === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.stroke();
    animationFrameId.current = requestAnimationFrame(draw);
  }, [mainColor, lineWidth, weirdness, glowStrength]);

  useEffect(() => {
    if (isStarted) {
      animationFrameId.current = requestAnimationFrame(draw);
    }
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isStarted, draw]);

  const handleSliderMove = (clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const sliderVal = Math.max(0, Math.min(MAX_SLIDER, ((clientX - rect.left) / rect.width) * MAX_SLIDER));
    setFrequency(sliderToFreq(sliderVal));
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    handleSliderMove(e.touches[0].clientX);
  };

  const onTouchStartSlider = (e: React.TouchEvent<HTMLDivElement>) => {
    handleSliderMove(e.touches[0].clientX);
  };

  const handleCanvasTap = () => {
    setWaveTypeIndex((prevIndex) => (prevIndex + 1) % WAVE_TYPES.length);
    gizmoRuntime.performHaptic('light');
  };

  return (
    <>
      <DigitalFontLoader />
      <div className="fixed inset-0 -z-10" style={{ backgroundColor }} />
      <div
        className="h-screen w-screen flex flex-col items-center justify-center text-white select-none"
        style={{ fontFamily: '"Space Mono", monospace' }}
      >
        {isStarted && (
          <div className="relative w-full h-full">
            <div
              className="absolute inset-0 flex items-center justify-center overflow-hidden"
              onTouchStart={handleCanvasTap}
            >
              <canvas ref={canvasRef} className="w-full h-[90vh] absolute top-0" width="1024" height="500" />
            </div>

            {activeInfo && (
              <div 
                className="absolute bottom-[10vh] left-0 right-0 p-3 max-w-xs mx-auto text-center z-30 pointer-events-none"
                style={{ color: textColor }}
              >
                <p className="font-bold text-lg" style={{ color: mainColor, textShadow: `0 0 ${glowStrength}px ${mainColor}` }}>{activeInfo.label}</p>
                <p className="text-sm">{activeInfo.description}</p>
              </div>
            )}

            <div
              className="w-full h-[10vh] absolute bottom-0 left-0 right-0 z-20"
              onTouchStart={onTouchStartSlider}
              onTouchMove={onTouchMove}
            >
              <div ref={sliderRef} className="w-full h-full cursor-pointer relative" style={{ backgroundColor: backgroundColor }}>
                {INTERESTING_FREQUENCIES.map((point) => {
                  const pos = freqToSlider(point.freq);
                  if (pos >= MIN_SLIDER && pos <= MAX_SLIDER) {
                    return (
                      <div
                        key={point.freq}
                        className="absolute top-0 bottom-0 w-px"
                        style={{
                          left: `${(pos / MAX_SLIDER) * 100}%`,
                          backgroundColor: mainColor,
                          opacity: 0.3,
                          boxShadow: `0 0 ${glowStrength}px ${mainColor}`,
                        }}
                      />
                    );
                  }
                  return null;
                })}
                <div
                  className="h-full"
                  style={{
                    width: `${(freqToSlider(frequency) / MAX_SLIDER) * 100}%`,
                    backgroundColor: mainColor,
                    boxShadow: `0 0 ${glowStrength}px ${mainColor}`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}