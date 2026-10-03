import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import { gizmoRuntime } from '@gizmo/runtime';
import { Plus, Minus, Mic, Music, ArrowUp, ArrowDown, SlidersHorizontal } from 'lucide-react';

// --- TWEAKS ---
const tweaks = gizmoRuntime.tweaks({
  // Harmonics Group
  maxHarmonics: { index: 0, name: 'Max Harmonics', type: 'slider', value: 8.0, min: 1, max: 8, step: 1, group: 'Synth Engine' },
  attackTime: { index: 1, name: 'Attack', type: 'slider', value: 0.23, min: 0.01, max: 2, step: 0.01, group: 'Synth Engine' },
  decayTime: { index: 2, name: 'Decay', type: 'slider', value: 0.1, min: 0.01, max: 2, step: 0.01, group: 'Synth Engine' },
  sustainLevel: { index: 3, name: 'Sustain', type: 'slider', value: 0.3, min: 0, max: 1, step: 0.01, group: 'Synth Engine' },
  releaseTime: { index: 4, name: 'Release', type: 'slider', value: 0.5, min: 0.1, max: 2, step: 0.1, group: 'Synth Engine' },
  // Colors Group
  backgroundColor: { index: 5, name: 'Background', type: 'color', value: '#e0e5ec', group: 'Visuals' },
  waveformColor: { index: 6, name: 'Waveform', type: 'color', value: '#555555', group: 'Visuals' },
  primaryColor: { index: 7, name: 'Primary', type: 'color', value: "#0AABF5", group: 'Visuals' },
  accentColor: { index: 8, name: 'Accent', type: 'color', value: '#ff2d75', group: 'Visuals' },
  // Piano Group
  pianoKeyColor: { index: 9, name: 'Key', type: 'color', value: '#e0e5ec', group: 'Piano' },
  pianoSharpColor: { index: 10, name: 'Sharp Key', type: 'color', value: '#333333', group: 'Piano' },
});

// --- PIANO NOTES ---
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const getPianoNotes = (octave: number) => {
  return [...NOTES.map(n => `${n}${octave}`), `C${octave + 1}`];
};

// --- HELPER COMPONENT for Neumorphism ---
const NeumorphicBox = ({ children, className = '', pressed = false, style = {} }: { children?: React.ReactNode, className?: string, pressed?: boolean, style?: React.CSSProperties }) => {
  const baseStyle: React.CSSProperties = {
    borderRadius: '1rem', // Softer corners
    transition: 'box-shadow 0.2s ease-in-out',
    ...style,
  };

  const shadowStyle: React.CSSProperties = pressed
    ? { boxShadow: 'inset 5px 5px 10px #a3b1c6, inset -5px -5px 10px #ffffff' }
    : { boxShadow: '5px 5px 10px #a3b1c6, -5px -5px 10px #ffffff' };

  return (
    <div className={className} style={{ ...baseStyle, ...shadowStyle }}>
      {children}
    </div>
  );
};

// --- MAIN COMPONENT ---
export default function Component() {
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [harmonics, setHarmonics] = useState([1, 0.5, 0.25]);
  const [isListening, setIsListening] = useState(false);
  const [activeNotes, setActiveNotes] = useState<string[]>([]);
  const [pressedButtons, setPressedButtons] = useState<Record<string, boolean>>({});
  const [octave, setOctave] = useState(4);
  const [showAdsrEditor, setShowAdsrEditor] = useState(false);
  const [hold, setHold] = useState(false);
  const [heldNotes, setHeldNotes] = useState<string[]>([]);
  const [envelope, setEnvelope] = useState({
    attack: 0.23,
    decay: 0.1,
    sustain: 0.3,
    release: 0.5,
  });
  const [draggingAdsrPoint, setDraggingAdsrPoint] = useState<string | null>(null);

  const audioEngine = useRef<any>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const micAnalyser = useRef<any>({});
  const animationFrameId = useRef<number>();

  // --- Tweak values ---
  const maxHarmonics = tweaks.maxHarmonics.useState();
  const attackTime = tweaks.attackTime.useState();
  const decayTime = tweaks.decayTime.useState();
  const sustainLevel = tweaks.sustainLevel.useState();
  const releaseTime = tweaks.releaseTime.useState();
  const backgroundColor = tweaks.backgroundColor.useState();
  const waveformColor = tweaks.waveformColor.useState();
  const primaryColor = tweaks.primaryColor.useState();
  const accentColor = tweaks.accentColor.useState();
  const pianoKeyColor = tweaks.pianoKeyColor.useState();
  const pianoSharpColor = tweaks.pianoSharpColor.useState();

  // Sync tweaks to local envelope state
  useEffect(() => {
    setEnvelope({
      attack: attackTime,
      decay: decayTime,
      sustain: sustainLevel,
      release: releaseTime,
    });
  }, [attackTime, decayTime, sustainLevel, releaseTime]);

  // --- Audio Engine Setup ---
  useEffect(() => {
    const initAudio = async () => {
      await Tone.start();
      setIsAudioReady(true);
      gizmoRuntime.performHaptic('medium');

      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'custom', partials: harmonics },
        envelope: { attack: envelope.attack, decay: envelope.decay, sustain: envelope.sustain, release: envelope.release },
      }).toDestination();
      const waveform = new Tone.Waveform();
      synth.connect(waveform);

      audioEngine.current = { synth, waveform };
    };

    initAudio();

    return () => {
      if (audioEngine.current.synth) {
        audioEngine.current.synth.dispose();
      }
      if (audioEngine.current.waveform) {
        audioEngine.current.waveform.dispose();
      }
      if (micAnalyser.current.stream) {
        micAnalyser.current.stream.getTracks().forEach((track: any) => track.stop());
      }
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  // --- Update Synth on Tweak/Harmonic Change ---
  useEffect(() => {
    if (audioEngine.current.synth) {
      audioEngine.current.synth.set({
        oscillator: { partials: harmonics },
        envelope: { attack: envelope.attack, decay: envelope.decay, sustain: envelope.sustain, release: envelope.release },
      });
    }
  }, [harmonics, envelope]);

  // --- Waveform Drawing ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;

    const drawAdsrEnvelope = () => {
      ctx.clearRect(0, 0, width, height);
      
      const padding = 10; // Add padding to prevent cropping
      const contentWidth = width - padding * 2;
      
      const totalTime = envelope.attack + envelope.decay + envelope.release;
      const attackX = padding + (envelope.attack / totalTime) * contentWidth * 0.9;
      const decayX = padding + ((envelope.attack + envelope.decay) / totalTime) * contentWidth * 0.9;
      const sustainX = decayX + 20; // Visual representation of sustain
      const releaseX = width - padding;

      const peakY = 10; // Top padding
      const sustainY = height - (envelope.sustain * (height - 20)) - 10;
      const endY = height - 10;

      // Draw lines
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padding, endY);
      ctx.lineTo(attackX, peakY);
      ctx.lineTo(decayX, sustainY);
      ctx.lineTo(sustainX, sustainY);
      ctx.lineTo(releaseX, endY);
      ctx.stroke();

      // Draw points
      const points = {
        attack: { x: attackX, y: peakY },
        decay: { x: decayX, y: sustainY },
        sustain: { x: sustainX, y: sustainY },
        release: { x: releaseX, y: endY },
      };

      Object.entries(points).forEach(([key, pos]) => {
        ctx.fillStyle = draggingAdsrPoint === key ? accentColor : primaryColor;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(key.charAt(0).toUpperCase(), pos.x, pos.y);
      });
    };

    const drawStaticWaveform = () => {
      ctx.clearRect(0, 0, width, height);
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, primaryColor);
      gradient.addColorStop(1, accentColor);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, midY);

      let maxAmplitude = 0;
      for (const h of harmonics) {
        maxAmplitude += h;
      }
      const scaleFactor = maxAmplitude > 0 ? (height / 2) * 0.9 / maxAmplitude : 0;

      for (let x = 0; x < width; x++) {
        let y = 0;
        const angle = (x / width) * Math.PI * 2;
        for (let i = 0; i < harmonics.length; i++) {
          const amplitude = harmonics[i];
          const frequency = i + 1;
          y += amplitude * Math.sin(angle * frequency);
        }
        ctx.lineTo(x, midY - y * scaleFactor);
      }
      ctx.stroke();
    };

    const drawLiveWaveform = () => {
      if (!audioEngine.current.waveform) return;
      const waveformValues = audioEngine.current.waveform.getValue();
      ctx.clearRect(0, 0, width, height);
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, primaryColor);
      gradient.addColorStop(1, accentColor);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, midY);

      for (let i = 0; i < waveformValues.length; i++) {
        const x = (i / waveformValues.length) * width;
        const y = (waveformValues[i] / 2 + 0.5) * height;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    const animate = () => {
      if (showAdsrEditor) {
        drawAdsrEnvelope();
      } else if (activeNotes.length > 0) {
        drawLiveWaveform();
      } else {
        drawStaticWaveform();
      }
      animationFrameId.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [harmonics, primaryColor, accentColor, activeNotes.length, showAdsrEditor, envelope, draggingAdsrPoint]);

  // --- Interaction Handlers ---
  const handleInitialPress = async () => {
    if (!isAudioReady) {
      await Tone.start();
      setIsAudioReady(true);
      gizmoRuntime.performHaptic('medium');
    }
  };

  const handleHarmonicChange = (index: number, value: number) => {
    const newHarmonics = [...harmonics];
    newHarmonics[index] = value;
    setHarmonics(newHarmonics);
  };

  const handleAdsrTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!showAdsrEditor) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;

    const padding = 10;
    const contentWidth = canvas.width - padding * 2;

    const totalTime = envelope.attack + envelope.decay + envelope.release;
    const attackX = padding + (envelope.attack / totalTime) * contentWidth * 0.9;
    const decayX = padding + ((envelope.attack + envelope.decay) / totalTime) * contentWidth * 0.9;
    const sustainY = canvas.height - (envelope.sustain * (canvas.height - 20)) - 10;
    const releaseX = canvas.width - padding;
    const endY = canvas.height - 10;

    const points = {
      attack: { x: attackX, y: 10 },
      decay: { x: decayX, y: sustainY },
      sustain: { x: decayX + 20, y: sustainY },
      release: { x: releaseX, y: endY },
    };

    for (const [key, pos] of Object.entries(points)) {
      const dist = Math.sqrt(Math.pow(touchX - pos.x, 2) + Math.pow(touchY - pos.y, 2));
      if (dist < 20) { // 20px touch radius
        setDraggingAdsrPoint(key);
        gizmoRuntime.performHaptic('light');
        return;
      }
    }
  };

  const handleAdsrTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!draggingAdsrPoint || !showAdsrEditor) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 10;
    const contentWidth = width - padding * 2;

    setEnvelope(prev => {
      let newAttack = prev.attack;
      let newDecay = prev.decay;
      let newSustain = prev.sustain;
      let newRelease = prev.release;

      const totalTime = prev.attack + prev.decay + prev.release;
      const attackX = padding + (prev.attack / totalTime) * contentWidth * 0.9;
      const decayX = padding + ((prev.attack + prev.decay) / totalTime) * contentWidth * 0.9;

      if (draggingAdsrPoint === 'attack') {
        const attackRatio = Math.max(0.01, (touchX - padding) / (contentWidth * 0.9));
        newAttack = attackRatio * totalTime;
        newAttack = Math.min(newAttack, (decayX / (contentWidth * 0.9)) * totalTime - 0.01); // Prevent crossing decay
      } else if (draggingAdsrPoint === 'decay') {
        const decayStartRatio = (prev.attack / totalTime);
        const decayEndRatio = Math.max(decayStartRatio + 0.01, (touchX - padding) / (contentWidth * 0.9));
        newDecay = (decayEndRatio - decayStartRatio) * totalTime;
      } else if (draggingAdsrPoint === 'sustain') {
        newSustain = Math.max(0, Math.min(1, 1 - ((touchY - 10) / (height - 20))));
      } else if (draggingAdsrPoint === 'release') {
        const sustainPointX = decayX + 20;
        const releasePixelWidth = width - padding - sustainPointX;
        const draggedReleasePixel = Math.max(1, touchX - sustainPointX);
        const maxReleaseTime = 4.0;
        newRelease = 0.1 + (draggedReleasePixel / releasePixelWidth) * (maxReleaseTime - 0.1);
        newRelease = Math.max(0.1, Math.min(maxReleaseTime, newRelease));
      }
      
      return { ...prev, attack: newAttack, decay: newDecay, sustain: newSustain, release: newRelease };
    });
  };

  const handleAdsrTouchEnd = () => {
    if (draggingAdsrPoint) {
      setDraggingAdsrPoint(null);
      gizmoRuntime.performHaptic('soft');
    }
  };

  const handleHarmonicTouch = (e: React.TouchEvent<HTMLDivElement>, index: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    if (!touch) return; // Prevent error on touch end
    const touchY = touch.clientY - rect.top;
    const value = Math.max(0, Math.min(1, 1 - (touchY / rect.height)));
    handleHarmonicChange(index, value);
  };

  const addHarmonic = () => {
    if (harmonics.length < maxHarmonics) {
      setHarmonics([...harmonics, 0]);
      gizmoRuntime.performHaptic('light');
    }
  };

  useEffect(() => {
    if (harmonics.length > maxHarmonics) {
      setHarmonics(harmonics.slice(0, maxHarmonics));
    }
  }, [maxHarmonics, harmonics]);

  const removeHarmonic = () => {
    if (harmonics.length > 1) {
      setHarmonics(harmonics.slice(0, -1));
      gizmoRuntime.performHaptic('light');
    }
  };

  const changeOctave = (direction: number) => {
    const newOctave = Math.max(0, Math.min(8, octave + direction));
    setOctave(newOctave);
    gizmoRuntime.performHaptic('light');
  };

  const handleListen = useCallback(async () => {
    if (!isAudioReady) await handleInitialPress();
    if (isListening) return;

    try {
      setIsListening(true);
      gizmoRuntime.performHaptic('heavy');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = Tone.getContext().rawContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      micAnalyser.current = { stream, source, analyser };

      setTimeout(() => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        // Find the fundamental frequency (the strongest peak)
        let maxVal = 0;
        let fundamentalBin = 0;
        // Start search above ~60Hz to avoid DC offset and low-frequency noise
        const minBin = Math.floor(60 / (audioContext.sampleRate / analyser.fftSize));
        for (let i = minBin; i < dataArray.length; i++) {
          if (dataArray[i] > maxVal) {
            maxVal = dataArray[i];
            fundamentalBin = i;
          }
        }

        if (fundamentalBin > 0) {
          const newHarmonics = Array(harmonics.length).fill(0);
          // Find the loudest harmonic to normalize against
          let maxHarmonicValue = 0;
          for (let i = 0; i < newHarmonics.length; i++) {
            const harmonicBin = Math.round(fundamentalBin * (i + 1));
            if (harmonicBin < dataArray.length) {
              const value = dataArray[harmonicBin];
              newHarmonics[i] = value;
              if (value > maxHarmonicValue) {
                maxHarmonicValue = value;
              }
            }
          }
          
          // Normalize the harmonics so the loudest is 1.0
          if (maxHarmonicValue > 0) {
            for (let i = 0; i < newHarmonics.length; i++) {
              newHarmonics[i] /= maxHarmonicValue;
            }
          }
          setHarmonics(newHarmonics);
        }

        stream.getTracks().forEach(track => track.stop());
        source.disconnect();
        setIsListening(false);
        gizmoRuntime.performHaptic('soft');
      }, 500); // Reduced timeout for quicker analysis

    } catch (err) {
      console.error("Microphone access denied:", err);
      setIsListening(false);
    }
  }, [isAudioReady, isListening, harmonics]);

  const handlePianoPress = (note: string) => {
    if (!isAudioReady) return;
    audioEngine.current.synth.triggerAttack(note);
    setActiveNotes(prev => [...prev, note]);
    if (hold) {
      setHeldNotes(prev => [...prev, note]);
    }
    gizmoRuntime.performHaptic('light');
  };

  const handlePianoRelease = (note: string) => {
    if (!isAudioReady) return;
    if (hold) return; // Don't release if hold is active
    audioEngine.current.synth.triggerRelease(note);
    setActiveNotes(prev => prev.filter(n => n !== note));
  };

  useEffect(() => {
    if (!hold && heldNotes.length > 0) {
      audioEngine.current.synth.triggerRelease(heldNotes);
      setActiveNotes(prev => prev.filter(n => !heldNotes.includes(n)));
      setHeldNotes([]);
    }
  }, [hold, heldNotes]);

  if (!isAudioReady) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ backgroundColor }}>
        <div className="text-2xl font-bold" style={{ color: primaryColor }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col font-sans" style={{ backgroundColor, color: '#555' }}>
      {/* Header */}
      <header className="p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold" style={{ color: primaryColor }}>OVERTONE <span className="font-light text-base">harmonic synthesiser</span></h1>
        <div className="flex items-center gap-2">
          <button
            onTouchStart={() => {
              setShowAdsrEditor(s => !s);
              setPressedButtons(p => ({ ...p, adsr: true }));
              gizmoRuntime.performHaptic('light');
            }}
            onTouchEnd={() => setPressedButtons(p => ({ ...p, adsr: false }))}
            className={`p-3 transition-all duration-200`}
            style={{
              borderRadius: '50%',
              background: `linear-gradient(145deg, #f0f5fd, #caced4)`,
              boxShadow: pressedButtons.adsr || showAdsrEditor
                ? 'inset 5px 5px 10px #a3b1c6, inset -5px -5px 10px #ffffff'
                : '5px 5px 10px #a3b1c6, -5px -5px 10px #ffffff',
              color: showAdsrEditor ? accentColor : primaryColor,
            }}
          >
            <SlidersHorizontal size={24} />
          </button>
          <button
            onTouchStart={() => {
              handleListen();
              setPressedButtons(p => ({ ...p, listen: true }));
            }}
            onTouchEnd={() => setPressedButtons(p => ({ ...p, listen: false }))}
            className={`p-3 transition-all duration-200`}
            style={{
              borderRadius: '50%',
              background: `linear-gradient(145deg, #f0f5fd, #caced4)`,
              boxShadow: pressedButtons.listen
                ? 'inset 5px 5px 10px #a3b1c6, inset -5px -5px 10px #ffffff'
                : '5px 5px 10px #a3b1c6, -5px -5px 10px #ffffff',
              color: isListening ? accentColor : primaryColor,
            }}
            disabled={isListening}
          >
            {isListening ? <Music size={24} className="animate-pulse" /> : <Mic size={24} />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col p-4 pt-0 gap-4 overflow-hidden">
        {/* Waveform */}
        <div className="w-full h-24 rounded-2xl p-1" style={{ boxShadow: 'inset 7px 7px 15px #a3b1c6, inset -7px -7px 15px #ffffff' }}>
          <canvas 
            ref={canvasRef} 
            className="w-full h-full rounded-xl" 
            width="375" 
            height="88"
            onTouchStart={handleAdsrTouchStart}
            onTouchMove={handleAdsrTouchMove}
            onTouchEnd={handleAdsrTouchEnd}
          />
        </div>

        {/* Harmonics Editor */}
        <div className="flex-grow flex flex-col">
          <div className="flex justify-between items-center mb-2 px-1">
            <h2 className="font-bold">Harmonics ({harmonics.length})</h2>
            <div className="flex gap-2">
              <button
                onTouchStart={() => { removeHarmonic(); setPressedButtons(p => ({ ...p, minus: true })); }}
                onTouchEnd={() => setPressedButtons(p => ({ ...p, minus: false }))}
                className="p-2"
                style={{
                  borderRadius: '50%',
                  background: `linear-gradient(145deg, #f0f5fd, #caced4)`,
                  boxShadow: pressedButtons.minus ? 'inset 4px 4px 8px #a3b1c6, inset -4px -4px 8px #ffffff' : '4px 4px 8px #a3b1c6, -4px -4px 8px #ffffff',
                  color: primaryColor,
                }}
              ><Minus size={16} /></button>
              <button
                onTouchStart={() => { addHarmonic(); setPressedButtons(p => ({ ...p, plus: true })); }}
                onTouchEnd={() => setPressedButtons(p => ({ ...p, plus: false }))}
                className="p-2"
                style={{
                  borderRadius: '50%',
                  background: `linear-gradient(145deg, #f0f5fd, #caced4)`,
                  boxShadow: pressedButtons.plus ? 'inset 4px 4px 8px #a3b1c6, inset -4px -4px 8px #ffffff' : '4px 4px 8px #a3b1c6, -4px -4px 8px #ffffff',
                  color: primaryColor,
                }}
              ><Plus size={16} /></button>
            </div>
          </div>
          
          {/* Horizontal scrollable harmonics */}
          <div className="flex-grow overflow-hidden">
            <div className="h-full overflow-x-auto overflow-y-hidden pb-2">
              <div className={`flex h-full px-1 ${harmonics.length > 8 ? 'gap-1.5 min-w-max' : 'gap-1 w-full'}`}>
                {harmonics.map((value, i) => (
                  <div key={i} className={`flex flex-col items-center gap-1 ${harmonics.length > 8 ? 'flex-shrink-0 w-8' : 'flex-1'}`}>
                    <div 
                      className={`relative flex-grow rounded-full overflow-hidden ${harmonics.length > 8 ? 'w-5' : 'w-full'}`} 
                      style={{ boxShadow: 'inset 3px 3px 6px #a3b1c6, inset -3px -3px 6px #ffffff', minHeight: '120px' }}
                      onTouchStart={(e) => handleHarmonicTouch(e, i)}
                      onTouchMove={(e) => handleHarmonicTouch(e, i)}
                    >
                      <div
                        className="absolute bottom-0 w-full"
                        style={{ 
                          height: `${Math.max(0, value * 100)}%`,
                          background: `linear-gradient(to top, ${accentColor}, ${primaryColor})`,
                        }}
                      />
                      {/* Input is now just for accessibility, main interaction is touch */}
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={value}
                        onChange={(e) => handleHarmonicChange(i, parseFloat(e.target.value))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer pointer-events-none"
                        style={{ 
                          WebkitAppearance: 'slider-vertical',
                          writingMode: 'bt-lr',
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono mt-1">{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Piano Roll */}
      <footer className="h-36 w-full flex-shrink-0 flex flex-col px-2 pb-2">
        <div className="flex justify-center items-center gap-4 mb-2">
          <div className="w-1/3 flex justify-start">
            {/* Placeholder for future left button */}
          </div>
          <div className="w-1/3 flex justify-center items-center gap-2">
            <button
              onTouchStart={() => { changeOctave(-1); setPressedButtons(p => ({ ...p, octaveDown: true })); }}
              onTouchEnd={() => setPressedButtons(p => ({ ...p, octaveDown: false }))}
              className="p-2"
              style={{
                borderRadius: '50%',
                background: `linear-gradient(145deg, #f0f5fd, #caced4)`,
                boxShadow: pressedButtons.octaveDown ? 'inset 4px 4px 8px #a3b1c6, inset -4px -4px 8px #ffffff' : '4px 4px 8px #a3b1c6, -4px -4px 8px #ffffff',
                color: primaryColor,
              }}
            ><ArrowDown size={16} /></button>
            <span className="font-bold w-12 text-center">Oct {octave}</span>
            <button
              onTouchStart={() => { changeOctave(1); setPressedButtons(p => ({ ...p, octaveUp: true })); }}
              onTouchEnd={() => setPressedButtons(p => ({ ...p, octaveUp: false }))}
              className="p-2"
              style={{
                borderRadius: '50%',
                background: `linear-gradient(145deg, #f0f5fd, #caced4)`,
                boxShadow: pressedButtons.octaveUp ? 'inset 4px 4px 8px #a3b1c6, inset -4px -4px 8px #ffffff' : '4px 4px 8px #a3b1c6, -4px -4px 8px #ffffff',
                color: primaryColor,
              }}
            ><ArrowUp size={16} /></button>
          </div>
          <div className="w-1/3 flex justify-end">
            <button
              onTouchStart={() => {
                setHold(h => !h);
                setPressedButtons(p => ({ ...p, hold: true }));
                gizmoRuntime.performHaptic('medium');
              }}
              onTouchEnd={() => setPressedButtons(p => ({ ...p, hold: false }))}
              className="p-2 px-4 rounded-full text-sm font-bold"
              style={{
                background: `linear-gradient(145deg, #f0f5fd, #caced4)`,
                boxShadow: pressedButtons.hold || hold
                  ? 'inset 4px 4px 8px #a3b1c6, inset -4px -4px 8px #ffffff'
                  : '4px 4px 8px #a3b1c6, -4px -4px 8px #ffffff',
                color: hold ? accentColor : primaryColor,
              }}
            >
              Hold
            </button>
          </div>
        </div>
        
        <div className="flex-grow relative w-full h-full">
          {/* White Keys */}
          <div className="absolute inset-0 flex">
            {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map((noteName, index) => {
              const note = `${noteName}${octave}`;
              const isActive = activeNotes.includes(note) || heldNotes.includes(note);
              const isPressed = !!pressedButtons[note];
              const keyWidth = 100 / 7;

              let borderRadiusClass = 'rounded-b-lg';
              if (index === 0) {
                borderRadiusClass = 'rounded-bl-lg rounded-tl-lg';
              } else if (index === 6) {
                borderRadiusClass = 'rounded-br-lg rounded-tr-lg';
              }

              return (
                <div
                  key={note}
                  onTouchStart={() => { handlePianoPress(note); setPressedButtons(p => ({ ...p, [note]: true })); }}
                  onTouchEnd={() => { handlePianoRelease(note); setPressedButtons(p => ({ ...p, [note]: false })); }}
                  onTouchCancel={() => { handlePianoRelease(note); setPressedButtons(p => ({ ...p, [note]: false })); }}
                  className={`h-full flex items-end justify-center pb-2 font-mono text-xs transition-all duration-100 border-r border-b border-gray-400/50 ${borderRadiusClass}`}
                  style={{
                    width: `${keyWidth}%`,
                    background: pianoKeyColor,
                    boxShadow: isPressed || isActive ? 'inset 3px 3px 7px #a3b1c6, inset -3px -3px 7px #ffffff' : '3px 3px 7px #a3b1c6, -3px -3px 7px #ffffff',
                    color: isActive ? accentColor : primaryColor,
                    borderTop: `2px solid ${isActive ? accentColor : 'transparent'}`,
                  }}
                >
                  {noteName}
                </div>
              );
            })}
          </div>

          {/* Black Keys */}
          <div className="absolute inset-0 pointer-events-none">
            {[null, 'C#', 'D#', null, 'F#', 'G#', 'A#', null].map((noteName, index) => {
              if (!noteName) return null;
              
              const note = `${noteName}${octave}`;
              const isActive = activeNotes.includes(note) || heldNotes.includes(note);
              const isPressed = !!pressedButtons[note];
              const keyWidth = 100 / 7;
              const blackKeyWidth = keyWidth * 0.6;
              const leftPosition = (index * keyWidth) - (blackKeyWidth / 2);

              return (
                <div
                  key={note}
                  onTouchStart={(e) => { e.stopPropagation(); handlePianoPress(note); setPressedButtons(p => ({ ...p, [note]: true })); }}
                  onTouchEnd={(e) => { e.stopPropagation(); handlePianoRelease(note); setPressedButtons(p => ({ ...p, [note]: false })); }}
                  onTouchCancel={(e) => { e.stopPropagation(); handlePianoRelease(note); setPressedButtons(p => ({ ...p, [note]: false })); }}
                  className="absolute top-0 h-[60%] flex items-end justify-center pb-1 font-mono text-xs transition-all duration-100 rounded-b-md z-10 pointer-events-auto"
                  style={{
                    left: `${leftPosition}%`,
                    width: `${blackKeyWidth}%`,
                    background: pianoSharpColor,
                    boxShadow: isPressed || isActive ? `inset 1px 1px 3px #000, inset -1px -1px 3px #4e4e4e` : '2px 2px 4px #000, -1px -1px 2px #4e4e4e',
                    color: isActive ? accentColor : pianoKeyColor,
                    borderBottom: `2px solid ${isActive ? accentColor : 'transparent'}`,
                  }}
                >
                  {noteName.replace('#', 'â™¯')}
                </div>
              );
            })}
          </div>
        </div>
      </footer>
    </div>
  );
}