import React, { useRef, useEffect, useCallback, useState } from 'react';
import { budgetDpr } from '../pixelBudget.js';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { shaderMaterial, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { gizmoRuntime } from '@gizmo/runtime';
import * as Tone from 'tone';
import { Volume2, VolumeX } from 'lucide-react';

// Tweaks for user customization
const tweaks = gizmoRuntime.tweaks({
  pixelSize: { index: 0, name: 'Pixel Size', type: 'slider', value: 8.0, min: 2, max: 12, step: 1, group: 'Pixel Art' },
  fractalDetail: { index: 1, name: 'Fractal Detail', type: 'slider', value: 12, min: 8, max: 24, step: 2, group: 'Performance' },
  colorSpeed: { index: 2, name: 'Color Speed', type: 'slider', value: 0.15, min: 0, max: 1, step: 0.05, group: 'Visuals' },
  backgroundColor: { index: 3, name: 'Background', type: 'color', value: '#000000', group: 'Colors' },
  primaryColor: { index: 4, name: 'Primary', type: 'color', value: "#32E4A6", group: 'Colors' },
  secondaryColor: { index: 5, name: 'Secondary', type: 'color', value: "#E253F9", group: 'Colors' },
  defaultZoom: { index: 6, name: 'Default Zoom', type: 'slider', value: 1.3, min: 1, max: 10, step: 0.1, group: 'Camera' },
  tempo: { index: 7, name: 'Tempo (BPM)', type: 'slider', value: 120.0, min: 90, max: 180, step: 5, group: 'Audio' },
  cutoff: { index: 8, name: 'Filter Cutoff', type: 'slider', value: 550.0, min: 200, max: 2000, step: 50, group: 'Audio' },
  resonance: { index: 9, name: 'Filter Resonance', type: 'slider', value: 25.0, min: 1, max: 25, step: 1, group: 'Audio' },
});

// Optimized shader for pixel art fractal
const PixelFractalMaterial = shaderMaterial(
  {
    u_time: 0,
    u_resolution: new THREE.Vector2(),
    u_cameraPos: new THREE.Vector3(),
    u_cameraLookAt: new THREE.Vector3(),
    u_iterations: 12,
    u_colorSpeed: 0.3,
    u_pixelSize: 4.0,
    u_primaryColor: new THREE.Vector3(0.89, 0.196, 0.718),
    u_secondaryColor: new THREE.Vector3(0.325, 0.710, 0.976),
  },
  // Vertex Shader
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader - optimized for performance and pixel art
  `
    precision mediump float;
    varying vec2 vUv;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec3 u_cameraPos;
    uniform vec3 u_cameraLookAt;
    uniform int u_iterations;
    uniform float u_colorSpeed;
    uniform float u_pixelSize;
    uniform vec3 u_primaryColor;
    uniform vec3 u_secondaryColor;

    const float BAILOUT = 4.0;
    const int MAX_STEPS = 32; // Reduced for performance
    const float MIN_DIST = 0.01;
    const float MAX_DIST = 20.0;

    // Simplified mandelbulb for performance
    float mandelbulbDE(vec3 pos) {
      vec3 z = pos;
      float dr = 1.0;
      float r = 0.0;
      float power = 6.0 + sin(u_time * 0.1) * 2.0;
      
      // Reduced iterations for performance
      for (int i = 0; i < 6; i++) {
        r = length(z);
        if (r > BAILOUT) break;
        
        // Seamless looping by wrapping theta and phi
        float theta = acos(mod(z.z / r, 2.0) - 1.0);
        float phi = atan(z.y, z.x);
        dr = pow(r, power - 1.0) * power * dr + 1.0;
        
        float zr = pow(r, power);
        theta *= power;
        phi *= power;
        
        z = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
        z += pos;
      }
      return 0.5 * log(r) * r / dr;
    }

    // Pixelated UV coordinates
    vec2 pixelate(vec2 uv, float pixelSize) {
      vec2 pixelUv = floor(uv * u_resolution / pixelSize) * pixelSize / u_resolution;
      return pixelUv;
    }

    // Simple scene with domain warping
    float sceneDE(vec3 p) {
      // Psychedelic rotation
      p.xz *= mat2(cos(u_time * 0.1), -sin(u_time * 0.1), sin(u_time * 0.1), cos(u_time * 0.1));
      p.y += sin(p.x * 3.0 + u_time * 0.5) * 0.2;
      
      return mandelbulbDE(p);
    }

    // Fast raymarch
    vec2 raymarch(vec3 ro, vec3 rd) {
      float d = 0.0;
      int steps = 0;
      
      for (int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * d;
        float ds = sceneDE(p);
        d += ds * 0.8; // Faster stepping for performance
        if (ds < MIN_DIST || d > MAX_DIST) break;
        steps = i;
      }
      return vec2(d, float(steps));
    }
    
    // Pixel art color palette (limited colors)
    vec3 pixelArtPalette(float t, vec3 p) {
      // Quantize the color parameter for pixel art look
      t = floor(t * 8.0) / 8.0;
      
      float colorMix = sin(t * 6.28 + u_time * u_colorSpeed) * 0.5 + 0.5;
      vec3 color = mix(u_primaryColor, u_secondaryColor, colorMix);
      
      // Add some position-based variation
      float variation = sin(dot(p, vec3(1.0, 2.0, 3.0)) * 5.0) * 0.3;
      color += variation * vec3(0.2, 0.4, 0.6);
      
      // Quantize colors for pixel art effect
      color = floor(color * 6.0) / 6.0;
      
      return color;
    }

    void main() {
      // Pixelate the UV coordinates
      vec2 pixelUv = pixelate(vUv, u_pixelSize);
      vec2 uv = (pixelUv - 0.5) * u_resolution / min(u_resolution.x, u_resolution.y);
      
      vec3 ro = u_cameraPos;
      vec3 target = u_cameraLookAt;
      vec3 fwd = normalize(target - ro);
      vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
      vec3 up = cross(fwd, right);
      vec3 rd = normalize(fwd + uv.x * right + uv.y * up);

      vec2 res = raymarch(ro, rd);
      float d = res.x;
      float steps = res.y;
      vec3 col = vec3(0.0);

      if (d < MAX_DIST) {
        vec3 p = ro + rd * d;
        float t = steps / 32.0 + u_time * u_colorSpeed * 0.5;
        col = pixelArtPalette(t, p);
        
        // Simple lighting
        float lighting = 0.5 + 0.5 * sin(steps * 0.5);
        col *= lighting;
      }
      
      // Add pixel art dithering effect
      float dither = fract(sin(dot(pixelUv, vec2(12.9898, 78.233))) * 43758.5453);
      col += (dither - 0.5) * 0.05;
      
      gl_FragColor = vec4(col, 1.0);
    }
  `
);

extend({ PixelFractalMaterial });

const PixelFractal = () => {
  const materialRef = useRef<THREE.ShaderMaterial>(null!);
  const { camera, size, controls } = useThree();
  const fractalDetail = tweaks.fractalDetail.useState();
  const colorSpeed = tweaks.colorSpeed.useState();
  const pixelSize = tweaks.pixelSize.useState();
  const primaryColor = tweaks.primaryColor.useState();
  const secondaryColor = tweaks.secondaryColor.useState();

  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ] : [1, 1, 1];
  };

  useEffect(() => {
    if (materialRef.current) {
        materialRef.current.uniforms.u_resolution.value.set(size.width, size.height);
    }
  }, [size]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.u_time.value = state.clock.getElapsedTime();
      materialRef.current.uniforms.u_cameraPos.value.copy(camera.position);
      
      const orbitControls = (controls as any);
      if (orbitControls) {
        materialRef.current.uniforms.u_cameraLookAt.value.copy(orbitControls.target);
      }
      
      materialRef.current.uniforms.u_iterations.value = fractalDetail;
      materialRef.current.uniforms.u_colorSpeed.value = colorSpeed;
      materialRef.current.uniforms.u_pixelSize.value = pixelSize;
      
      const primary = hexToRgb(primaryColor);
      const secondary = hexToRgb(secondaryColor);
      materialRef.current.uniforms.u_primaryColor.value.set(primary[0], primary[1], primary[2]);
      materialRef.current.uniforms.u_secondaryColor.value.set(secondary[0], secondary[1], secondary[2]);
    }
  });

  return (
    <mesh>
      <boxGeometry args={[4, 4, 4]} />
      <pixelFractalMaterial ref={materialRef} side={THREE.BackSide} />
    </mesh>
  );
};

// --- Acid Bassline Generator ---
const AcidTrack = () => {
  const audioInitialized = useRef(false);
  const instruments = useRef<any>(null);
  const sequence = useRef<any>(null);

  const tempo = tweaks.tempo.useState();
  const cutoff = tweaks.cutoff.useState();
  const resonance = tweaks.resonance.useState();

  const notes = ['C2', 'D#2', 'C2', 'G2', 'C2', 'D#2', 'C2', 'C2', 'C2', 'G2', 'D#2', 'C2', 'G2', 'D#2', 'G2', 'C2'];

  useEffect(() => {
    // Setup Tone.js instruments
    const filter = new Tone.Filter(400, "lowpass", -12);
    filter.Q.value = 15;

    const synth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: {
        attack: 0.01,
        decay: 0.08, // Shorter decay for a tighter sound
        sustain: 0.1,
        release: 0.1,
      },
    }).connect(filter);

    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.03, // Tighter kick
      octaves: 8,
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: 0.3,
        sustain: 0.01,
        release: 1.0,
        attackCurve: 'exponential',
      },
    }).toDestination();

    const hihat = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
    }).toDestination();
    hihat.volume.value = -18;

    const distortion = new Tone.Distortion(0.4);
    const reverb = new Tone.Reverb({ decay: 1.0, wet: 0.2 });
    filter.chain(distortion, reverb, Tone.Destination);

    instruments.current = { synth, kick, hihat, filter };

    // Bassline sequence
    sequence.current = new Tone.Sequence((time, note) => {
      // Add some velocity variation for a groovier feel
      const velocity = Math.random() * 0.5 + 0.5; // More variation
      instruments.current.synth.triggerAttackRelease(note, '16n', time, velocity);
      // Modulate resonance per note
      const resValue = Math.random() * 15 + 10; // Random resonance between 10 and 25
      instruments.current.filter.Q.rampTo(resValue, 0.05);
    }, notes, '16n');

    const kickLoop = new Tone.Loop(time => {
      instruments.current.kick.triggerAttackRelease('C1', '8n', time);
    }, '4n');

    // More interesting hi-hat pattern
    const hihatLoop = new Tone.Loop(time => {
        instruments.current.hihat.triggerAttackRelease('16n', time);
    }, '16n');

    // Add a filter LFO for movement
    const filterLfo = new Tone.LFO("2m", 300, 1500);
    filterLfo.connect(instruments.current.filter.frequency);
    filterLfo.start();

    sequence.current.start(0);
    kickLoop.start(0);
    hihatLoop.start(0);

    Tone.Transport.bpm.value = tempo;

    // Start audio context and transport on first interaction
    const startAudio = async () => {
      if (audioInitialized.current) return;
      try {
        await Tone.start();
        if (Tone.Transport.state !== 'started') {
            Tone.Transport.start();
        }
        audioInitialized.current = true;
        console.log("Audio context started and transport running.");
      } catch (e) {
        console.error("Could not start audio:", e);
      }
    };

    // We need a user interaction to start the audio context.
    // This will be triggered by the main component's pointer handler.
    document.addEventListener('pointerdown', startAudio, { once: true });

    return () => {
      document.removeEventListener('pointerdown', startAudio);
      if (Tone.Transport.state === 'started') {
        Tone.Transport.stop();
      }
      Tone.Transport.cancel();
      sequence.current?.dispose();
      kickLoop?.dispose();
      hihatLoop?.dispose();
      filterLfo?.dispose(); // Dispose LFO
      Object.values(instruments.current).forEach((inst: any) => inst.dispose());
    };
  }, []);

  // Update parameters from tweaks
  useEffect(() => {
    if (!instruments.current) return;
    Tone.Transport.bpm.value = tempo;
    instruments.current.filter.frequency.value = cutoff;
    instruments.current.filter.Q.value = resonance;
  }, [tempo, cutoff, resonance]);

  return null;
};

export default function Component() {
  const backgroundColor = tweaks.backgroundColor.useState();
  const defaultZoom = tweaks.defaultZoom.useState();
  const [audioReady, setAudioReady] = useState(false);
  const audioStartedRef = useRef(false);

  // Called on pointerdown (mouse/pen) and pointerup (touch: browsers only unlock
  // audio on touchend/pointerup), plus Space/Enter. Safe to call repeatedly.
  const handleInteraction = useCallback(async () => {
    if (!audioReady && !audioStartedRef.current) {
      try {
        await Tone.start();
        if (Tone.getContext().state !== 'running' || audioStartedRef.current) return;
        audioStartedRef.current = true;
        if (Tone.Transport.state !== 'started') {
          Tone.Transport.start();
        }
        setAudioReady(true);
        gizmoRuntime.performHaptic('light');
        console.log("Audio context started on interaction.");
      } catch (e) {
        console.error("Error starting Tone.js on interaction:", e);
      }
    }
  }, [audioReady]);

  // Keyboard (desktop): Space / Enter also starts the audio
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') handleInteraction();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleInteraction]);

  // Ensure transport stops when component unmounts
  useEffect(() => {
    return () => {
      if (Tone.Transport.state === 'started') {
        Tone.Transport.stop();
        Tone.Transport.cancel();
      }
    }
  }, []);

  return (
    <>
      <div aria-hidden className="fixed inset-0 -z-10" style={{ background: backgroundColor }} />
      <div className="h-screen w-screen cursor-grab active:cursor-grabbing" onPointerDown={handleInteraction} onPointerUp={handleInteraction}>
        <Canvas 
          camera={{ position: [0, 0, defaultZoom], fov: 60 }} 
          dpr={budgetDpr()}
          gl={{ 
            antialias: false, // Disable for pixel art
            powerPreference: "high-performance",
            preserveDrawingBuffer: false, // Performance optimization
          }}
        >
          <React.Suspense fallback={null}>
            <PixelFractal />
          </React.Suspense>
          <OrbitControls
            enableZoom={false}
            enablePan={true}
            enableRotate={true}
            minPolarAngle={0} // Allow full vertical rotation
            maxPolarAngle={Math.PI} // Allow full vertical rotation
            minAzimuthAngle={-Infinity} // Allow infinite horizontal rotation
            maxAzimuthAngle={Infinity} // Allow infinite horizontal rotation
            minDistance={1.5}
            maxDistance={6}
            zoomSpeed={1.2}
            panSpeed={1.0}
            rotateSpeed={0.8}
            autoRotate={true}
            autoRotateSpeed={1.0}
            enableDamping={true}
            dampingFactor={0.05}
          />
        </Canvas>
      </div>
      {audioReady && <AcidTrack />}
    </>
  );
}
