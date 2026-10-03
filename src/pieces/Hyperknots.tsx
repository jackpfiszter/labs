import React, { useRef, useMemo, Suspense, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { gizmoRuntime } from '@gizmo/runtime';
import { OrbitControls, Float, PerspectiveCamera } from '@react-three/drei';

const tweaks = gizmoRuntime.tweaks({
  knotColor: { index: 0, name: 'Primary Color', type: 'color', value: "#000000" },
  accentColor: { index: 1, name: 'Accent Color', type: 'color', value: "#000000" },
  glowColor: { index: 2, name: 'Glow Color', type: 'color', value: "#000000" },
  stripeColor: { index: 3, name: 'Stripe Color', type: 'color', value: "#FFFEFE" },
  lightAColor: { index: 4, name: 'Light A Color', type: 'color', value: "#FFFFFF" },
  lightBColor: { index: 5, name: 'Light B Color', type: 'color', value: "#FFFFFF" },
  backgroundColor: { index: 6, name: 'Background Color', type: 'color', value: '#000000' },
  complexity: { index: 7, name: 'Complexity', type: 'slider', value: 10.0, min: 1, max: 10, step: 1 },
  intertwine: { index: 8, name: 'Intertwine Count', type: 'slider', value: 5.0, min: 1, max: 5, step: 1 },
  warpStrength: { index: 9, name: 'Warp Intensity', type: 'slider', value: 0.05, min: 0, max: 1, step: 0.05 },
  warpSpeed: { index: 10, name: 'Warp Speed', type: 'slider', value: 0.2, min: 0.1, max: 5, step: 0.1 },
  knotP: { index: 11, name: 'Knot P (Loops)', type: 'slider', value: 8.0, min: 1, max: 20, step: 1 },
  knotQ: { index: 12, name: 'Knot Q (Twists)', type: 'slider', value: 11.0, min: 1, max: 20, step: 1 },
  tubeRadius: { index: 13, name: 'Tube Thickness', type: 'slider', value: 0.05, min: 0.05, max: 0.5, step: 0.01 },
  glowIntensity: { index: 14, name: 'Glow Intensity', type: 'slider', value: 0.0, min: 0, max: 2, step: 0.1 },
  stripeIntensity: { index: 15, name: 'Stripe Intensity', type: 'slider', value: 1.0, min: 0, max: 1, step: 0.1 },
  motionSensitivity: { index: 16, name: 'Motion Tilt', type: 'slider', value: 0.0, min: 0, max: 2, step: 0.1 },
  animationSpeed: { index: 17, name: 'Animation Speed', type: 'slider', value: 0.5, min: 0, max: 2, step: 0.1 },
  showLabels: { index: 18, name: 'Show UI', type: 'toggle', value: false },
  loopsLabel: { index: 19, name: 'Loops Label', type: 'text', value: 'Loops', group: 'loops' },
  loopsColor: { index: 20, name: 'Loops Color', type: 'color', value: '#FFFFFF', group: 'loops' },
  loopsSize: { index: 21, name: 'Loops Size', type: 'slider', value: 12, min: 8, max: 24, step: 1, group: 'loops' },
  loopsVisible: { index: 22, name: 'Loops Visible', type: 'toggle', value: true, group: 'loops' },
  twistsLabel: { index: 23, name: 'Twists Label', type: 'text', value: 'Twists', group: 'twists' },
  twistsColor: { index: 24, name: 'Twists Color', type: 'color', value: '#FFFFFF', group: 'twists' },
  twistsSize: { index: 25, name: 'Twists Size', type: 'slider', value: 12, min: 8, max: 24, step: 1, group: 'twists' },
  twistsVisible: { index: 26, name: 'Twists Visible', type: 'toggle', value: true, group: 'twists' },
});

const ComplexKnotShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#8762F6') },
    uAccentColor: { value: new THREE.Color('#E3EBA2') },
    uGlowColor: { value: new THREE.Color('#53B5F9') },
    uStripeColor: { value: new THREE.Color('#FFDD46') },
    uWarpStrength: { value: 0.2 },
    uWarpSpeed: { value: 1.5 },
    uComplexity: { value: 3.0 },
    uGlow: { value: 0.6 },
    uStripeIntensity: { value: 0.5 },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vDisplacement;
    
    uniform float uTime;
    uniform float uWarpStrength;
    uniform float uWarpSpeed;
    uniform float uComplexity;

    void main() {
      vUv = uv;
      vNormal = normal;
      
      vec3 pos = position;
      float t = uTime * uWarpSpeed;
      
      float warp = 0.0;
      const int MAX_ITER = 4;
      for(int i = 1; i <= MAX_ITER; i++) {
        float fi = float(i);
        if(fi > uComplexity) break;
        warp += sin(pos.y * (fi * 1.5) + t) * cos(pos.x * (fi * 1.2) + t) * (uWarpStrength / fi);
        warp += cos(pos.z * (fi * 1.8) - t * 0.5) * (uWarpStrength / (fi * 2.0));
      }
      
      pos += normal * warp;
      vDisplacement = warp;
      vPosition = pos;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vDisplacement;
    
    uniform vec3 uColor;
    uniform vec3 uAccentColor;
    uniform vec3 uGlowColor;
    uniform vec3 uStripeColor;
    uniform float uTime;
    uniform float uGlow;
    uniform float uStripeIntensity;

    void main() {
      vec3 viewDir = normalize(-vPosition);
      vec3 lightDir = normalize(vec3(5.0, 5.0, 10.0));
      
      float diff = max(dot(vNormal, lightDir), 0.0);
      float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.0);
      
      float colorMix = sin(vDisplacement * 10.0 + uTime) * 0.5 + 0.5;
      vec3 baseColor = mix(uColor, uAccentColor, colorMix);
      
      float stripes = step(0.8, sin(vUv.x * 50.0 + uTime * 2.0));
      vec3 irid = uStripeColor * (0.5 + 0.5 * cos(uTime + vUv.xyx + vec3(0, 2, 4)));
      
      vec3 finalColor = baseColor * (diff + 0.2);
      finalColor += irid * stripes * uStripeIntensity;
      finalColor += fresnel * uGlow * uGlowColor;
      
      float pulse = pow(sin(uTime * 0.5) * 0.5 + 0.5, 8.0);
      finalColor += pulse * uGlowColor * 0.5;

      // Calculate alpha based on brightness (black = transparent)
      float alpha = clamp(length(finalColor) * 2.0, 0.0, 1.0);
      
      // If the color is very close to black, discard or set alpha to 0
      if (length(finalColor) < 0.01) discard;

      gl_FragColor = vec4(finalColor, alpha);
    }
  `,
};

function KnotLayer({ index, p, q, radius, color, accentColor, glowColor, stripeColor, warpStrength, warpSpeed, complexity, glowIntensity, stripeIntensity, total, animationSpeed }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const timeRef = useRef(0);

  const rotationOffset = useMemo(() => new THREE.Euler(
    (index * Math.PI * 2) / total,
    (index * Math.PI) / total,
    0
  ), [index, total]);

  const scale = useMemo(() => 1 - (index * 0.1), [index]);

  useFrame((state, delta) => {
    timeRef.current += delta * animationSpeed;
    const t = timeRef.current;

    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = t;
      materialRef.current.uniforms.uColor.value.set(color);
      materialRef.current.uniforms.uAccentColor.value.set(accentColor);
      materialRef.current.uniforms.uGlowColor.value.set(glowColor);
      materialRef.current.uniforms.uStripeColor.value.set(stripeColor);
      materialRef.current.uniforms.uWarpStrength.value = warpStrength;
      materialRef.current.uniforms.uWarpSpeed.value = warpSpeed;
      materialRef.current.uniforms.uComplexity.value = complexity;
      materialRef.current.uniforms.uGlow.value = glowIntensity;
      materialRef.current.uniforms.uStripeIntensity.value = stripeIntensity;
    }

    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005 * (index + 1) * animationSpeed;
      meshRef.current.rotation.x += 0.003 * (index + 1) * animationSpeed;
      const breath = 1 + Math.sin(t * 0.5 + index) * 0.02;
      meshRef.current.scale.set(scale * breath, scale * breath, scale * breath);
    }
  });

  const geometry = useMemo(() => {
    const safeP = Math.max(1, Math.floor(p || 2));
    const safeQ = Math.max(1, Math.floor(q || 3));
    const segments = 256 + (complexity * 64);
    return new THREE.TorusKnotGeometry(2, radius, segments, 64, safeP, safeQ);
  }, [p, q, radius, complexity]);

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={rotationOffset}>
      <shaderMaterial
        ref={materialRef}
        args={[ComplexKnotShader]}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Scene({ knotP, knotQ }) {
  const knotColor = tweaks.knotColor.useState();
  const accentColor = tweaks.accentColor.useState();
  const glowColor = tweaks.glowColor.useState();
  const stripeColor = tweaks.stripeColor.useState();
  const lightAColor = tweaks.lightAColor.useState();
  const lightBColor = tweaks.lightBColor.useState();
  const complexity = tweaks.complexity.useState();
  const intertwine = tweaks.intertwine.useState();
  const warpStrength = tweaks.warpStrength.useState();
  const warpSpeed = tweaks.warpSpeed.useState();
  const tubeRadius = tweaks.tubeRadius.useState();
  const glowIntensity = tweaks.glowIntensity.useState();
  const stripeIntensity = tweaks.stripeIntensity.useState();
  const motionSensitivity = tweaks.motionSensitivity.useState();
  const animationSpeed = tweaks.animationSpeed.useState();

  const groupRef = useRef<THREE.Group>(null);
  const motionRef = useRef({ roll: 0, pitch: 0 });

  useEffect(() => {
    let hasGyro = false;
    const removeListener = gizmoRuntime.addMotionListener((event) => {
      hasGyro = true;
      motionRef.current = {
        roll: event.attitude.roll,
        pitch: event.attitude.pitch
      };
    });
    // Desktop fallback: mouse position stands in for device tilt (never overrides a real gyro)
    const onPointerMove = (e: PointerEvent) => {
      if (hasGyro || e.pointerType !== 'mouse') return;
      motionRef.current = {
        roll: ((e.clientX / window.innerWidth) * 2 - 1) * 0.6,
        pitch: ((e.clientY / window.innerHeight) * 2 - 1) * 0.6
      };
    };
    window.addEventListener('pointermove', onPointerMove);
    return () => {
      removeListener();
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, []);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        motionRef.current.pitch * motionSensitivity,
        0.1
      );
      groupRef.current.rotation.z = THREE.MathUtils.lerp(
        groupRef.current.rotation.z,
        -motionRef.current.roll * motionSensitivity,
        0.1
      );
    }
  });

  useEffect(() => {
    gizmoRuntime.performHaptic('light');
  }, [complexity, intertwine, knotP, knotQ]);

  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={2} color={lightAColor} />
      <pointLight position={[-10, -10, -10]} intensity={1} color={lightBColor} />
      
      <group ref={groupRef}>
        <Suspense fallback={null}>
          <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
            {Array.from({ length: intertwine }).map((_, i) => (
              <KnotLayer 
                key={i}
                index={i}
                total={intertwine}
                p={knotP} 
                q={knotQ} 
                radius={tubeRadius} 
                color={knotColor} 
                accentColor={accentColor}
                glowColor={glowColor}
                stripeColor={stripeColor}
                warpStrength={warpStrength}
                warpSpeed={warpSpeed}
                complexity={complexity}
                glowIntensity={glowIntensity}
                stripeIntensity={stripeIntensity}
                animationSpeed={animationSpeed}
              />
            ))}
          </Float>
        </Suspense>
      </group>

      <OrbitControls 
        enablePan={false} 
        minDistance={4} 
        maxDistance={12} 
        makeDefault 
      />
    </>
  );
}

// Keep the knot framed on tall screens: widen the vertical fov so the horizontal view never
// gets narrower than the knot (landscape keeps the original 50deg).
const BASE_FOV = 50;
const MIN_HALF_WIDTH_TAN = 0.42;

function ResponsiveCamera() {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  useEffect(() => {
    const aspect = width / Math.max(1, height);
    const tanHalf = Math.max(Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2)), MIN_HALF_WIDTH_TAN / aspect);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanHalf));
    camera.updateProjectionMatrix();
  }, [camera, width, height]);
  return null;
}

const isCoarsePointer = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export default function Component() {
  const backgroundColor = tweaks.backgroundColor.useState();
  const showLabels = tweaks.showLabels.useState();
  
  const knotP = tweaks.knotP.useState();
  const knotQ = tweaks.knotQ.useState();
  
  const loopsLabel = tweaks.loopsLabel.useState();
  const loopsColor = tweaks.loopsColor.useState();
  const loopsSize = tweaks.loopsSize.useState();
  const loopsVisible = tweaks.loopsVisible.useState();
  
  const twistsLabel = tweaks.twistsLabel.useState();
  const twistsColor = tweaks.twistsColor.useState();
  const twistsSize = tweaks.twistsSize.useState();
  const twistsVisible = tweaks.twistsVisible.useState();

  const [knotPValue, setKnotPValue] = React.useState(knotP);
  const [knotQValue, setKnotQValue] = React.useState(knotQ);

  // Sync internal state with tweak changes from the menu
  useEffect(() => {
    setKnotPValue(knotP);
  }, [knotP]);

  useEffect(() => {
    setKnotQValue(knotQ);
  }, [knotQ]);

  return (
    <div className="h-screen w-screen overflow-hidden relative cursor-grab active:cursor-grabbing" style={{ background: backgroundColor }}>
      <Canvas
        shadows
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 7]} fov={BASE_FOV} />
        <ResponsiveCamera />
        <Scene knotP={knotPValue} knotQ={knotQValue} />
      </Canvas>

      {/* Simple UI Sliders */}
      {/* Each bar sits in a 44px-tall hit area so it is easy to grab on touch */}
      <div
        className="absolute mx-auto max-w-2xl flex flex-col gap-0 pointer-events-auto cursor-default"
        style={{
          bottom: 'max(1.875rem, calc(env(safe-area-inset-bottom) + 0.5rem))',
          left: 'max(3rem, calc(env(safe-area-inset-left) + 1rem))',
          right: 'max(3rem, calc(env(safe-area-inset-right) + 1rem))',
        }}
      >
        {loopsVisible && (
          <div className="group relative w-full h-11 flex items-center">
            <div className="relative w-full h-2 bg-black border border-white/20 group-hover:border-white/40 rounded-full overflow-hidden transition-colors">
              <div 
                className="absolute top-0 left-0 h-full bg-white rounded-full transition-all duration-75"
                style={{ width: `${((knotPValue - 1) / 19) * 100}%` }}
              />
            </div>
            <input 
              type="range" 
              min="1" 
              max="20" 
              step="1" 
              value={knotPValue} 
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setKnotPValue(val);
                gizmoRuntime.performHaptic('light');
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        )}

        {twistsVisible && (
          <div className="group relative w-full h-11 flex items-center">
            <div className="relative w-full h-2 bg-black border border-white/20 group-hover:border-white/40 rounded-full overflow-hidden transition-colors">
              <div 
                className="absolute top-0 left-0 h-full bg-white rounded-full transition-all duration-75"
                style={{ width: `${((knotQValue - 1) / 19) * 100}%` }}
              />
            </div>
            <input 
              type="range" 
              min="1" 
              max="20" 
              step="1" 
              value={knotQValue} 
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setKnotQValue(val);
                gizmoRuntime.performHaptic('light');
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        )}
      </div>
      
      {showLabels && (
        <>
          <div className="absolute top-12 left-0 right-0 flex flex-col items-center pointer-events-none select-none">
            <h1 className="text-white text-2xl font-black tracking-tighter uppercase italic opacity-90">
              Infinite Knot
            </h1>
            <div className="h-1 w-12 bg-gradient-to-r from-transparent via-white to-transparent mt-1" />
          </div>

          <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center pointer-events-none select-none gap-2">
            <div className="bg-black/40 backdrop-blur-xl px-6 py-3 rounded-full border border-white/20 shadow-2xl">
              <p className="text-white/90 text-[10px] font-bold tracking-[0.2em] uppercase">
                {isCoarsePointer()
                  ? 'Tilt Device • Drag to Rotate • Pinch to Zoom'
                  : 'Move Mouse to Tilt • Drag to Rotate • Scroll to Zoom'}
              </p>
            </div>
          </div>
          
          <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-white/20 pointer-events-none" />
          <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-white/20 pointer-events-none" />
          <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-white/20 pointer-events-none" />
          <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-white/20 pointer-events-none" />
        </>
      )}
    </div>
  );
}