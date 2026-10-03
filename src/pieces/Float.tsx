import React, { useRef, useEffect, useState, Suspense } from 'react';
import { budgetDpr } from '../pixelBudget.js';
import { gizmoRuntime } from '@gizmo/runtime';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { TextureLoader, Color, RepeatWrapping } from 'three';

const tweaks = gizmoRuntime.tweaks({
  causticIntensity: { type: 'slider', value: 0.3, min: 0.1, max: 1, step: 0.05, name: 'Caustic Intensity', index: 0 },
  causticSpeed: { type: 'slider', value: 0.5, min: 0.1, max: 2, step: 0.1, name: 'Caustic Speed', index: 1 },
  warpFactor: { type: 'slider', value: 0.1, min: 0.0, max: 0.3, step: 0.01, name: 'Warp Factor', index: 2 },
  poolColor: { type: 'color', value: "#75EEFF", name: 'Pool Color', index: 3 },
  causticColor: { type: 'color', value: "#478497", name: 'Caustic Color', index: 4 },
  borderColor: { type: 'color', value: '#FFFFFF', name: 'Border Color', index: 5 },
  ringFloatSpeed: { type: 'slider', value: 1.0, min: 0.1, max: 3.0, step: 0.1, name: 'Ring Float Speed', index: 6 },
  poolMargin: { type: 'slider', value: 71.0, min: 10, max: 100, step: 1, name: 'Pool Margin', index: 7 },
  ringSize: { type: 'slider', value: 0.5, min: 0.2, max: 2.0, step: 0.1, name: 'Ring Size', index: 8 },
  outerTileScale: { type: 'slider', value: 55.0, min: 40, max: 200, step: 5, name: 'Outer Tile Scale', index: 9 },
  innerTileScale: { type: 'slider', value: 10.0, min: 2.0, max: 20.0, step: 0.5, name: 'Inner Tile Scale', index: 10 },
  shadowOffsetX: { type: 'slider', value: 0.049999997, min: -0.2, max: 0.2, step: 0.01, name: 'Shadow Offset X', index: 11 },
  shadowOffsetY: { type: 'slider', value: -0.2, min: -0.2, max: 0.2, step: 0.01, name: 'Shadow Offset Y', index: 12 },
  shadowBlur: { type: 'slider', value: 8.5, min: 0.0, max: 20.0, step: 0.5, name: 'Shadow Blur', index: 13 },
});

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec3 u_poolColor;
  uniform vec3 u_causticColor;
  uniform float u_causticIntensity;
  uniform float u_warpFactor;
  uniform float u_innerTileScale;
  uniform float u_uvScale;

  varying vec2 vUv;

  // 2D Noise function
  float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  // Simplex noise for water surface
  float water(vec2 p) {
    float total = 0.0;
    float freq = 2.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      total += sin(p.x * freq + u_time) * amp;
      total += cos(p.y * freq + u_time) * amp;
      freq *= 2.0;
      amp *= 0.5;
    }
    return total;
  }

  void main() {
    // Plane is scaled up to cover wide/tall viewports; scale UVs to match so tiles keep their size
    vec2 uv = (vUv - 0.5) * u_uvScale + 0.5;
    
    // Warp the UVs to simulate looking through water
    float warp = water(uv * 5.0) * u_warpFactor;
    vec2 warpedUv = uv + warp;

    // Draw tiles
    vec2 tileUv = fract(warpedUv * u_innerTileScale);
    float tileEdge = step(0.95, tileUv.x) + step(0.95, tileUv.y);
    vec3 tileColor = mix(u_poolColor, u_poolColor * 0.9, tileEdge);

    // Caustics
    float c1 = water(warpedUv * 4.0 + 0.5 * u_time);
    float c2 = water(warpedUv * 6.0 - 0.4 * u_time);
    float caustics = smoothstep(0.4, 0.6, c1) + smoothstep(0.5, 0.7, c2);
    caustics = clamp(caustics, 0.0, 1.0) * u_causticIntensity;

    vec3 finalColor = tileColor + u_causticColor * caustics;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

const shadowFragmentShader = `
  precision highp float;
  
  uniform sampler2D u_texture;
  uniform float u_opacity;
  uniform float u_blur;

  varying vec2 vUv;

  const int SAMPLES = 9;

  void main() {
    vec4 color = vec4(0.0);
    float total = 0.0;
    float radius = u_blur * 0.01;

    for (int x = -SAMPLES / 2; x <= SAMPLES / 2; x++) {
      for (int y = -SAMPLES / 2; y <= SAMPLES / 2; y++) {
        vec2 offset = vec2(float(x), float(y)) * radius / float(SAMPLES);
        float d = distance(offset, vec2(0.0));
        float weight = pow(1.0 - d, 2.0);
        
        vec4 sampleColor = texture2D(u_texture, vUv + offset);
        // Use the alpha of the texture to shape the shadow
        color += vec4(0.0, 0.0, 0.0, sampleColor.a * weight);
        total += weight;
      }
    }

    if (total > 0.0) {
      color /= total;
    }

    gl_FragColor = vec4(color.rgb, color.a * u_opacity);
  }
`;

// On narrow (portrait) pools, pull the camera back so the floating ring (which drifts +/-0.2 and is ~0.5 wide) stays fully in view.
const BASE_VISIBLE_HEIGHT = 2 * Math.tan((75 / 2) * Math.PI / 180); // default fov 75, z = 1
const MIN_VISIBLE_WIDTH = 0.95;
const fitCameraZ = (aspect: number) => Math.max(1, MIN_VISIBLE_WIDTH / (BASE_VISIBLE_HEIGHT * aspect));

function PoolRing() {
  const ringRef = useRef<any>();
  const shadowRef = useRef<any>();
  const shadowMaterialRef = useRef<any>();

  const [ringIndex, setRingIndex] = useState(0);
  const ringTextures = [
    useLoader(TextureLoader, `${import.meta.env.BASE_URL}assets/float-yellow.png`), // yellow
    useLoader(TextureLoader, `${import.meta.env.BASE_URL}assets/float-pink.png`)  // pink
  ];
  const currentRingTexture = ringTextures[ringIndex];

  useEffect(() => {
    const swapRing = () => {
      setRingIndex(prev => (prev + 1) % ringTextures.length);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); swapRing(); }
    };
    // Swap on a tap or click. iOS Safari doesn't send `click` for taps on a plain
    // canvas, so taps are detected from pointer down/up instead.
    let tapStart: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => { if (e.isPrimary) tapStart = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (!e.isPrimary || !tapStart) return;
      const moved = Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y);
      tapStart = null;
      if (moved <= 10) swapRing();
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [ringTextures.length]);

  const ringFloatSpeed = tweaks.ringFloatSpeed.useState();
  const ringSize = tweaks.ringSize.useState();
  const shadowOffsetX = tweaks.shadowOffsetX.useState();
  const shadowOffsetY = tweaks.shadowOffsetY.useState();
  const shadowBlur = tweaks.shadowBlur.useState();

  useFrame(({ clock }) => {
    if (ringRef.current && shadowRef.current) {
      const time = clock.getElapsedTime() * ringFloatSpeed;
      const x = Math.sin(time * 0.5) * 0.2;
      const y = Math.cos(time * 0.7) * 0.15;
      
      ringRef.current.position.x = x;
      ringRef.current.position.y = y;
      ringRef.current.rotation.z = Math.sin(time * 0.3) * 0.3;

      shadowRef.current.position.x = x + shadowOffsetX;
      shadowRef.current.position.y = y + shadowOffsetY;
      shadowRef.current.rotation.z = ringRef.current.rotation.z;
    }
    if (shadowMaterialRef.current) {
      shadowMaterialRef.current.uniforms.u_blur.value = shadowBlur;
    }
  });
  
  const shadowUniforms = {
    u_texture: { value: currentRingTexture },
    u_opacity: { value: 0.3 },
    u_blur: { value: shadowBlur },
  };

  return (
    <>
      <mesh ref={shadowRef} position={[0.15, -0.25, 0.05]} scale={ringSize}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={shadowMaterialRef}
          vertexShader={vertexShader}
          fragmentShader={shadowFragmentShader}
          uniforms={shadowUniforms}
          transparent={true}
        />
      </mesh>
      <mesh ref={ringRef} position={[0.1, -0.2, 0.1]} scale={ringSize}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={currentRingTexture} transparent={true} />
      </mesh>
    </>
  );
}


function PoolShader() {
  const materialRef = useRef<any>();
  const causticIntensity = tweaks.causticIntensity.useState();
  const causticSpeed = tweaks.causticSpeed.useState();
  const warpFactor = tweaks.warpFactor.useState();
  const poolColor = tweaks.poolColor.useState();
  const causticColor = tweaks.causticColor.useState();
  const innerTileScale = tweaks.innerTileScale.useState();
  const { size } = useThree();
  // Cover the whole visible area (the 2x2 plane alone leaves gaps on wide screens / when zoomed out)
  const aspect = size.width / Math.max(1, size.height);
  const visibleHeight = BASE_VISIBLE_HEIGHT * fitCameraZ(aspect);
  const poolScale = Math.max(1, visibleHeight / 2, (visibleHeight * aspect) / 2) * 1.02;

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.u_time.value = clock.getElapsedTime() * causticSpeed;
      materialRef.current.uniforms.u_causticIntensity.value = causticIntensity;
      materialRef.current.uniforms.u_warpFactor.value = warpFactor;
      materialRef.current.uniforms.u_poolColor.value.set(poolColor);
      materialRef.current.uniforms.u_causticColor.value.set(causticColor);
      materialRef.current.uniforms.u_innerTileScale.value = innerTileScale;
      materialRef.current.uniforms.u_uvScale.value = poolScale;
      materialRef.current.uniforms.u_resolution.value = [size.width, size.height];
    }
  });

  const uniforms = {
    u_time: { value: 0 },
    u_resolution: { value: [size.width, size.height] },
    u_poolColor: { value: new Color(poolColor) },
    u_causticColor: { value: new Color(causticColor) },
    u_causticIntensity: { value: causticIntensity },
    u_warpFactor: { value: warpFactor },
    u_innerTileScale: { value: innerTileScale },
    u_uvScale: { value: poolScale },
  };

  return (
    <mesh scale={[poolScale, poolScale, 1]}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

function CameraFit() {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.set(0, 0, fitCameraZ(size.width / Math.max(1, size.height)));
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

export default function Component() {
  const borderColor = tweaks.borderColor.useState();
  const poolMargin = tweaks.poolMargin.useState();
  const outerTileScale = tweaks.outerTileScale.useState();
  
  return (
    <div className="h-screen w-screen overflow-hidden cursor-pointer" style={{ backgroundColor: borderColor }}>
      {/* Much larger pool simulation window */}
      <div 
        className="absolute"
        style={{
          top: `${poolMargin}px`,
          left: `${poolMargin}px`,
          right: `${poolMargin}px`,
          bottom: `${poolMargin}px`,
        }}
      >
        <Canvas camera={{ position: [0, 0, 1] }} dpr={budgetDpr()}>
          <CameraFit />
          <Suspense fallback={null}>
            <PoolShader />
            <PoolRing />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
