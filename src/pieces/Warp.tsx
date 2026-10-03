import React, { useRef, useEffect, useState, useCallback } from 'react';
import { gizmoRuntime } from '@gizmo/runtime';
import * as Tone from 'tone';
import { Power, Gauge, Volume2, VolumeX } from 'lucide-react';

const tweaks = gizmoRuntime.tweaks({
  starCount: { index: 0, name: 'Star Density', type: 'slider', value: 700.0, min: 200, max: 3000, step: 100 },
  maxSpeed: { index: 1, name: 'Max Speed', type: 'slider', value: 30.0, min: 10, max: 100, step: 5 },
  volume: { index: 2, name: 'Volume', type: 'slider', value: 0.0, min: -48, max: 0, step: 1 },
  backgroundColor: { index: 3, name: 'Space', type: 'color', value: '#000000' },
  starColor: { index: 4, name: 'Stars', type: 'color', value: '#FFFFFF' },
  hudColor: { index: 5, name: 'HUD', type: 'color', value: "#FFFFFF" },
  sliderColor: { index: 6, name: 'Slider Fill', type: 'color', value: '#FFFFFF' },
  sliderBgColor: { index: 7, name: 'Slider BG', type: 'color', value: "#000000" },
});

type Star = {
  x: number;
  y: number;
  z: number;
};

const Starfield = ({ speed, starCount, starColor, maxSpeed }: { speed: number; starCount: number; starColor: string; maxSpeed: number; }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const animationFrameRef = useRef<number>();
  const speedRef = useRef(speed);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const initStars = useCallback((width: number, height: number) => {
    const newStars: Star[] = [];
    for (let i = 0; i < starCount; i++) {
      newStars.push({
        x: Math.random() * width - width / 2,
        y: Math.random() * height - height / 2,
        z: Math.random() * width,
      });
    }
    starsRef.current = newStars;
  }, [starCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = canvas.getBoundingClientRect();
    initStars(width, height);
  }, [starCount, initStars]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;
    
    initStars(width, height);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2, height / 2);

      const currentSpeed = speedRef.current * maxSpeed;

      starsRef.current.forEach(star => {
        star.z -= currentSpeed;
        if (star.z <= 0) {
          star.x = Math.random() * width - width / 2;
          star.y = Math.random() * height - height / 2;
          star.z = width;
        }

        const k = 128 / star.z;
        const px = star.x * k;
        const py = star.y * k;

        const size = (1 - star.z / width) * 5;
        const shade = (1 - star.z / width) * 255;
        
        ctx.fillStyle = starColor;
        
        if (speedRef.current > 0.1) {
            const pz = star.z + currentSpeed * 2;
            const prev_k = 128 / pz;
            const prev_px = star.x * prev_k;
            const prev_py = star.y * prev_k;
            
            ctx.beginPath();
            ctx.moveTo(prev_px, prev_py);
            ctx.lineTo(px, py);
            ctx.strokeStyle = starColor;
            ctx.lineWidth = size > 0.5 ? size : 0.5;
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.arc(px, py, size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
      });

      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [starColor, maxSpeed, initStars, starCount]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
};

const SpeedSlider = ({ speed, onSpeedChange, sliderColor, sliderBgColor }: { speed: number; onSpeedChange: (speed: number) => void; sliderColor: string; sliderBgColor: string; }) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const fill = fillRef.current;
    if (fill) {
      fill.style.width = `${speed * 100}%`;
    }
  }, [speed]);

  const updateSpeed = useCallback((clientX: number) => {
    const slider = sliderRef.current;
    const fill = fillRef.current;
    if (!slider || !fill) return;

    const rect = slider.getBoundingClientRect();
    const value = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    
    onSpeedChange(value);
  }, [onSpeedChange]);

  const handleTouchStart = (e: React.TouchEvent) => {
    isDraggingRef.current = true;
    updateSpeed(e.touches[0].clientX);
    gizmoRuntime.performHaptic('light');
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDraggingRef.current) {
      updateSpeed(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
  };

  return (
    <div
      ref={sliderRef}
      className="absolute bottom-10 left-[10%] w-[80%] h-2 rounded-full"
      style={{ backgroundColor: sliderBgColor }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        ref={fillRef}
        className="h-full rounded-full"
        style={{ backgroundColor: sliderColor }}
      />
    </div>
  );
};

export default function Component() {
  const [speed, setSpeed] = useState(0.5);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioNodes = useRef<any>({});
  const lastHapticTime = useRef(0);

  const starCount = tweaks.starCount.useState();
  const maxSpeed = tweaks.maxSpeed.useState();
  const volume = tweaks.volume.useState();
  const backgroundColor = tweaks.backgroundColor.useState();
  const starColor = tweaks.starColor.useState();
  const hudColor = tweaks.hudColor.useState();
  const sliderColor = tweaks.sliderColor.useState();
  const sliderBgColor = tweaks.sliderBgColor.useState();

  useEffect(() => {
    const initAudio = async () => {
      await Tone.start();
      setIsAudioReady(true);
      
      // Set initial audio levels based on starting speed
      const { engineVolume, engineHum } = audioNodes.current;
      if (engineVolume && engineHum) {
        const now = Tone.now();
        const initialSpeed = 0.5;
        const targetVolume = Tone.gainToDb(initialSpeed * 0.8) - 25;
        engineVolume.volume.rampTo(targetVolume, 0.1, now);
        engineHum.frequency.rampTo(50 + initialSpeed * 150, 0.2, now);
      }
    };
    
    // Only initialize audio if it hasn't been done yet.
    if (!isAudioReady) {
        initAudio();
    }
  }, [isAudioReady]); // Run when isAudioReady changes, but logic prevents re-runs.

  useEffect(() => {
    const engineHum = new Tone.Oscillator({
        type: "sine",
        frequency: 50,
    }).start();

    const engineVolume = new Tone.Volume(-Infinity).toDestination();
    engineHum.connect(engineVolume);

    audioNodes.current = { engineHum, engineVolume };

    return () => {
      engineHum.dispose();
      engineVolume.dispose();
      filter.dispose();
    };
  }, []);

  useEffect(() => {
    if (isAudioReady) {
      Tone.Destination.volume.value = isMuted ? -Infinity : volume;
    }
  }, [volume, isMuted, isAudioReady]);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
    if (!isAudioReady) return;

    const { engineVolume, engineHum } = audioNodes.current;
    if (engineVolume && engineHum) {
        const now = Tone.now();
        if (newSpeed > 0.01) {
            const targetVolume = Tone.gainToDb(newSpeed * 0.8) - 25;
            engineVolume.volume.rampTo(targetVolume, 0.1, now);
            engineHum.frequency.rampTo(50 + newSpeed * 150, 0.2, now);
        } else {
            engineVolume.volume.rampTo(-Infinity, 0.5, now);
            engineHum.frequency.rampTo(50, 0.5, now);
        }
    }
    
    const currentTime = Date.now();
    if (newSpeed > 0.1 && currentTime - lastHapticTime.current > 100) {
        const hapticStyle = newSpeed > 0.9 ? 'heavy' : newSpeed > 0.5 ? 'medium' : 'light';
        gizmoRuntime.performHaptic(hapticStyle);
        lastHapticTime.current = currentTime;
    }
  }, [isAudioReady]);

  const toggleMute = () => {
    setIsMuted(prev => !prev);
    gizmoRuntime.performHaptic('light');
  };

  return (
    <>
      <div aria-hidden className="fixed inset-0 -z-10" style={{ background: backgroundColor }} />
      <div className="h-screen w-screen overflow-hidden">
        <Starfield speed={speed} starCount={starCount} starColor={starColor} maxSpeed={maxSpeed} />

        <div className="absolute top-5 right-5">
          <button onClick={toggleMute} style={{ color: hudColor }}>
            {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
          </button>
        </div>

        <SpeedSlider speed={speed} onSpeedChange={handleSpeedChange} sliderColor={sliderColor} sliderBgColor={sliderBgColor} />
      </div>
    </>
  );
}