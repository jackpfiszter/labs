import React, { useRef, useEffect, useMemo } from 'react';
import { budgetDpr } from '../../pixelBudget.js';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { gizmoRuntime } from '@gizmo/runtime';
import FitFov from './FitFov.js';

const tweaks = gizmoRuntime.tweaks({
  cameraDistance: { index: 0, name: 'Camera Distance', type: 'slider', value: 2.7, min: 1, max: 10, step: 0.1 },
  waveHeight: { index: 1, name: 'Wave Height', type: 'slider', value: 0.2, min: 0.1, max: 1.5, step: 0.1 },
  waveSpeed: { index: 2, name: 'Wave Speed', type: 'slider', value: 0.70000005, min: 0.1, max: 3.0, step: 0.1 },
  waveScale: { index: 3, name: 'Wave Scale', type: 'slider', value: 16.7, min: 1.0, max: 50.0, step: 0.1 },
  heightColorShift: { index: 4, name: 'Height Color Shift', type: 'slider', value: 20.0, min: 0.1, max: 20.0, step: 0.1 },
  peakHeight: { index: 5, name: 'Peak Height', type: 'slider', value: 0.0, min: -0.5, max: 1.0, step: 0.05 },
  shallowColor: { index: 6, name: 'Shallow Water', type: 'color', value: "#FFEE6C" },
  deepColor: { index: 7, name: 'Deep Water', type: 'color', value: "#FFFFFF" },
  peakColor: { index: 8, name: 'Wave Peak', type: 'color', value: "#FFA400" },
  foamColor: { index: 9, name: 'Foam', type: 'color', value: "#FFF8F8" },
  shallowWaterOpacity: { index: 10, name: 'Shallow Water Opacity', type: 'slider', value: 1.0, min: 0.0, max: 1.0, step: 0.01 },
  fresnelStrength: { index: 11, name: 'Fresnel Strength', type: 'slider', value: 0.5, min: 0.0, max: 1.0, step: 0.01 },
  foamWidth: { index: 12, name: 'Foam Width', type: 'slider', value: 0.05, min: 0.01, max: 0.5, step: 0.01 },
  foamIntensity: { index: 13, name: 'Foam Intensity', type: 'slider', value: 0.8, min: 0.0, max: 1.0, step: 0.01 },
  translucencyAmount: { index: 14, name: 'Translucency', type: 'slider', value: 0.2, min: 0.0, max: 1.0, step: 0.01 },
  surfaceRoughness: { index: 15, name: 'Surface Roughness', type: 'slider', value: 0.0, min: 0.0, max: 1.0, step: 0.01 },

  skyCenterColor: { index: 16, name: 'Sky Center', type: 'color', value: "#004444" },
  skyHorizonColor: { index: 17, name: 'Sky Horizon', type: 'color', value: "#0D061B" },

  starDensity: { index: 18, name: 'Star Density', type: 'slider', value: 1000, min: 100, max: 5000, step: 100 },

});

// Vertex shader for ocean surface
const vertexShader = `
  uniform float uTime;
  uniform float uWaveHeight;
  uniform float uWaveScale;
  uniform float uWaveSpeed;
  
  varying vec3 vPosition;
  varying vec2 vUv;
  varying float vElevation;
  
  // Classic Perlin 3D Noise by Stefan Gustavson
  vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }
  
  float cnoise(vec3 P) {
    vec3 Pi0 = floor(P); // Integer part
    vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
    Pi0 = mod(Pi0, 289.0);
    Pi1 = mod(Pi1, 289.0);
    vec3 Pf0 = fract(P); // Fractional part
    vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = Pi0.zzzz;
    vec4 iz1 = Pi1.zzzz;
    
    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);
    
    vec4 gx0 = ixy0 / 7.0;
    vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);
    
    vec4 gx1 = ixy1 / 7.0;
    vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);
    
    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
    
    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
    g000 *= norm0.x;
    g010 *= norm0.y;
    g100 *= norm0.z;
    g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
    g001 *= norm1.x;
    g011 *= norm1.y;
    g101 *= norm1.z;
    g111 *= norm1.w;
    
    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
    float n111 = dot(g111, Pf1);
    
    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
    return 2.2 * n_xyz;
  }
  
  void main() {
    vUv = uv;
    
    // Use the normalized position on the sphere as input for noise
    vec3 noisePos = normalize(position);

    // Multiple layers of noise for more realistic waves
    float noise1 = cnoise(vec3(noisePos.x * uWaveScale * 0.1 + uTime * uWaveSpeed * 0.2, noisePos.y * uWaveScale * 0.1 + uTime * uWaveSpeed * 0.1, noisePos.z * uWaveScale * 0.1 + uTime * uWaveSpeed * 0.05));
    float noise2 = cnoise(vec3(noisePos.x * uWaveScale * 0.3 + uTime * uWaveSpeed * 0.4, noisePos.y * uWaveScale * 0.3 + uTime * uWaveSpeed * 0.3, noisePos.z * uWaveScale * 0.3 + uTime * uWaveSpeed * 0.2));
    float noise3 = cnoise(vec3(noisePos.x * uWaveScale * 0.8 + uTime * uWaveSpeed * 0.6, noisePos.y * uWaveScale * 0.8 + uTime * uWaveSpeed * 0.5, noisePos.z * uWaveScale * 0.8 + uTime * uWaveSpeed * 0.4));
    float noise4 = cnoise(vec3(noisePos.x * uWaveScale * 2.0 + uTime * uWaveSpeed * 0.8, noisePos.y * uWaveScale * 2.0 + uTime * uWaveSpeed * 0.7, noisePos.z * uWaveScale * 2.0 + uTime * uWaveSpeed * 0.6));
    float noise5 = cnoise(vec3((noisePos.x + 10.0) * uWaveScale * 4.0 + uTime * uWaveSpeed * 1.0, (noisePos.y + 20.0) * uWaveScale * 4.0 + uTime * uWaveSpeed * 0.9, (noisePos.z + 30.0) * uWaveScale * 4.0 + uTime * uWaveSpeed * 0.8));
    float noise6 = cnoise(vec3((noisePos.x + 40.0) * uWaveScale * 8.0 + uTime * uWaveSpeed * 1.2, (noisePos.y + 50.0) * uWaveScale * 8.0 + uTime * uWaveSpeed * 1.1, (noisePos.z + 60.0) * uWaveScale * 8.0 + uTime * uWaveSpeed * 1.0));
    
    // Combine noise layers with different weights, adding more detail
    float combinedNoise = noise1 * 0.4 + noise2 * 0.25 + noise3 * 0.15 + noise4 * 0.1 + noise5 * 0.07 + noise6 * 0.03;
    
    // Sharpen the waves to make them more pronounced and create sharper points
    float sharpNoise = sign(combinedNoise) * pow(abs(combinedNoise), 1.5); // Increased exponent for sharper points
    
    // Calculate final elevation
    vElevation = sharpNoise * uWaveHeight;
    
    // Apply elevation to vertex by moving it along its normal
    vec3 newPosition = position + normal * vElevation;
    vPosition = newPosition;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

// Fragment shader for ocean surface
const fragmentShader = `
  uniform vec3 uShallowColor;
  uniform vec3 uDeepColor;
  uniform vec3 uPeakColor;
  uniform vec3 uFoamColor;
  uniform float uHeightColorShift;
  uniform float uPeakHeight;
  uniform float uShallowWaterOpacity;

  
  varying vec3 vPosition;
  varying vec2 vUv;
  varying float vElevation;
  
  void main() {
    // Calculate normal based on the displaced position
    vec3 worldNormal = normalize(vPosition); // Normal of the sphere at the displaced point
    

    float specular = 0.0; // Removed specular highlight
    
    // Water color based on elevation (depth)
    float depthFactor = smoothstep(-0.5, 0.5, vElevation * uHeightColorShift);
    // Base color is deep water
    vec3 baseColor = uDeepColor;

    // Blend shallow color on top of deep color based on depthFactor and opacity
    vec3 blendedColor = mix(baseColor, uShallowColor, depthFactor * uShallowWaterOpacity);

    // Add peak color to the highest points
    float peakFactor = smoothstep(uPeakHeight, uPeakHeight + 0.05, vElevation);
    blendedColor = mix(blendedColor, uPeakColor, peakFactor);
    
    // Add foam on wave peaks
    float foamFactor = smoothstep(0.35, 0.55, vElevation);
    blendedColor = mix(blendedColor, uFoamColor, foamFactor);
    
    // Apply lighting
    vec3 finalColor = blendedColor * 0.9;
    
    // Add subtle blue-green gradient based on position
    finalColor += mix(vec3(0.0, 0.05, 0.1), vec3(0.0, 0.1, 0.05), vUv.y) * (1.0 - depthFactor);
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export default function Component() {
  const rotationRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  
  // Get tweak values
  const cameraDistance = tweaks.cameraDistance.useState();
  const waveHeight = tweaks.waveHeight.useState();
  const waveSpeed = tweaks.waveSpeed.useState();
  const waveScale = tweaks.waveScale.useState();
  const heightColorShift = tweaks.heightColorShift.useState();
  const shallowColor = tweaks.shallowColor.useState();
  const deepColor = tweaks.deepColor.useState();
  const peakColor = tweaks.peakColor.useState();
  const foamColor = tweaks.foamColor.useState();
  const peakHeight = tweaks.peakHeight.useState();

  const skyCenterColor = tweaks.skyCenterColor.useState();
  const skyHorizonColor = tweaks.skyHorizonColor.useState();
  const shallowWaterOpacity = tweaks.shallowWaterOpacity.useState();
  const starDensity = tweaks.starDensity.useState();


  
  // Convert hex colors to THREE.Color
  const getThreeColor = (hexColor) => {
    return new THREE.Color(hexColor);
  };
  

  const handlePointerDown = (e) => {
    if (!e.isPrimary) return; // Ignore extra fingers so the drag doesn't jump
    isDraggingRef.current = true;
    e.target.setPointerCapture(e.pointerId); // Capture pointer for continuous dragging
    previousMousePositionRef.current = {
        x: e.clientX,
        y: e.clientY
    };
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    // Only process if it's a primary pointer (e.g., first touch or mouse)
    if (!e.isPrimary) return; // Ignore non-primary pointers (e.g., multi-touch)

    const deltaX = e.clientX - previousMousePositionRef.current.x;
    const deltaY = e.clientY - previousMousePositionRef.current.y;

    rotationRef.current.y += deltaX * 0.005;
    rotationRef.current.x += deltaY * 0.005;
    rotationRef.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationRef.current.x));

    previousMousePositionRef.current = {
        x: e.clientX,
        y: e.clientY
    };
  };

  const handlePointerUp = (e) => {
    if (!e.isPrimary) return;
    isDraggingRef.current = false;
    if (e.target.hasPointerCapture?.(e.pointerId)) e.target.releasePointerCapture(e.pointerId); // Release pointer capture
  };
  
  return (
    <div className="w-full h-full overflow-hidden relative cursor-grab active:cursor-grabbing">
      <Canvas
        dpr={budgetDpr()}
        camera={{ fov: 75, near: 0.1, far: 1000, position: [0, 0, cameraDistance] }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp} // onPointerLeave should also stop dragging
        style={{ touchAction: 'none' }}
      >
        <FitFov fov={75} minAspect={0.65} />
        <ambientLight intensity={1.0} />
        <OceanSphere
          waveHeight={waveHeight}
          waveScale={waveScale}
          waveSpeed={waveSpeed}
          shallowColor={shallowColor}
          deepColor={deepColor}
          peakColor={peakColor}
          foamColor={foamColor}
          heightColorShift={heightColorShift}
          peakHeight={peakHeight}
          shallowWaterOpacity={shallowWaterOpacity}
          rotationRef={rotationRef}
        />
        <Stars rotationRef={rotationRef} starDensity={starDensity} />
      </Canvas>
      <div
        className="w-full h-full absolute top-0 left-0 -z-10"
        style={{
          background: `radial-gradient(circle at center, ${skyCenterColor} 0%, ${skyHorizonColor} 80%)`,
        }}
      ></div>
    </div>
  );
}

function Stars({ rotationRef, starDensity }) {
  const starsRef = useRef();

  const positions = useMemo(() => {
    const positionsArray = new Float32Array(starDensity * 3);
    for (let i = 0; i < starDensity; i++) {
      const r = Math.random() * 200 + 100; // Distance from center
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;

      positionsArray[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positionsArray[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positionsArray[i * 3 + 2] = r * Math.cos(phi);
    }
    return positionsArray;
  }, [starDensity]);

  const dampedRotation = useRef(new THREE.Euler());

  useFrame(() => {
    if (starsRef.current) {
      dampedRotation.current.y += (rotationRef.current.y - dampedRotation.current.y) * 0.1;
      dampedRotation.current.x += (rotationRef.current.x - dampedRotation.current.x) * 0.1;
      dampedRotation.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, dampedRotation.current.x));

      starsRef.current.rotation.copy(dampedRotation.current);
    }
  });

  return (
    <points ref={starsRef}>
      <bufferGeometry attach="geometry">
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={positions.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial attach="material" color="white" size={0.5} sizeAttenuation={true} />
    </points>
  );
}

function OceanSphere({
  waveHeight,
  waveScale,
  waveSpeed,
  shallowColor,
  deepColor,
  peakColor,
  foamColor,
  heightColorShift,
  peakHeight,
  shallowWaterOpacity,
  rotationRef,
}) {
  const materialRef = useRef();
  const meshRef = useRef();
  const clock = useMemo(() => new THREE.Clock(), []);

  const getThreeColor = (hexColor) => {
    return new THREE.Color(hexColor);
  };

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
    if (meshRef.current) {
      // Apply damping
      meshRef.current.rotation.y += (rotationRef.current.y - meshRef.current.rotation.y) * 0.1;
      meshRef.current.rotation.x += (rotationRef.current.x - meshRef.current.rotation.x) * 0.1;

      // Limit rotation to prevent flipping
      meshRef.current.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, meshRef.current.rotation.x));
    }
  });

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uWaveHeight.value = waveHeight;
      materialRef.current.uniforms.uWaveScale.value = waveScale;
      materialRef.current.uniforms.uWaveSpeed.value = waveSpeed;
      materialRef.current.uniforms.uShallowColor.value = getThreeColor(shallowColor);
      materialRef.current.uniforms.uDeepColor.value = getThreeColor(deepColor);
      materialRef.current.uniforms.uPeakColor.value = getThreeColor(peakColor);
      materialRef.current.uniforms.uFoamColor.value = getThreeColor(foamColor);
      materialRef.current.uniforms.uHeightColorShift.value = heightColorShift;
      materialRef.current.uniforms.uPeakHeight.value = peakHeight;
      materialRef.current.uniforms.uShallowWaterOpacity.value = shallowWaterOpacity;
    }
  }, [waveHeight, waveScale, waveSpeed, shallowColor, deepColor, peakColor, foamColor, heightColorShift, peakHeight, shallowWaterOpacity]);

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 512, 512]} />
      <shaderMaterial
        ref={materialRef}
        attach="material"
        args={[{ vertexShader, fragmentShader }]} // Pass shaders directly
        uniforms={{
          uTime: { value: 0 },
          uWaveHeight: { value: waveHeight },
          uWaveScale: { value: waveScale },
          uWaveSpeed: { value: waveSpeed },
          uShallowColor: { value: getThreeColor(shallowColor) },
          uDeepColor: { value: getThreeColor(deepColor) },
          uPeakColor: { value: getThreeColor(peakColor) },
          uFoamColor: { value: getThreeColor(foamColor) },
          uHeightColorShift: { value: heightColorShift },
          uPeakHeight: { value: peakHeight },
          uShallowWaterOpacity: { value: shallowWaterOpacity },
        }}
      />
    </mesh>
  );
}
