import React, { useRef, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { gizmoRuntime } from '@gizmo/runtime';

const tweaks = gizmoRuntime.tweaks({
  zoomLevel: { index: 0, name: 'Zoom', type: 'slider', value: 15.0, min: 5, max: 50, step: 1 },
  minZoom: { index: 1, name: 'Min Zoom', type: 'slider', value: 1.0, min: 1, max: 20, step: 1 },
  maxZoom: { index: 2, name: 'Max Zoom', type: 'slider', value: 23.0, min: 21, max: 100, step: 1 },
  sphereSize: { index: 3, name: 'Sphere Size', type: 'slider', value: 1.5, min: 0.1, max: 1.5, step: 0.1 },
  helixRadius: { index: 4, name: 'Helix Radius', type: 'slider', value: 2.0, min: 1, max: 10, step: 0.5 },
  helixHeight: { index: 5, name: 'Helix Height', type: 'slider', value: 30.0, min: 5, max: 30, step: 1 },
  numSpheres: { index: 6, name: 'Sphere Count', type: 'slider', value: 20.0, min: 2, max: 200, step: 1 },
  waterColor: { index: 7, name: 'Water Surface', type: 'color', value: "#83FFC5", group: 'Water Colors' },
  waterDepthColor: { index: 8, name: 'Water Depth', type: 'color', value: "#3E7B76", group: 'Water Colors' },
  flowSpeed: { index: 9, name: 'Flow Speed', type: 'slider', value: 2.0, min: 0.1, max: 2.0, step: 0.1 },
  waveIntensity: { index: 10, name: 'Wave Intensity', type: 'slider', value: 2.0, min: 0.1, max: 2.0, step: 0.1 },
  highlightColor: { index: 11, name: 'Highlight Color', type: 'color', value: "#75FCB1", group: 'Water Colors' },
  highlightStrength: { index: 12, name: 'Highlight Strength', type: 'slider', value: 1.0, min: 0.0, max: 2.0, step: 0.1, group: 'Water Colors' },
  distortionStrength: { index: 13, name: 'Distortion Strength', type: 'slider', value: 0.04, min: 0.0, max: 0.2, step: 0.01, group: 'Water Colors' },
  backgroundTopColor: { index: 14, name: 'Background Top', type: 'color', value: "#002F2D", group: 'Background' },
  backgroundBottomColor: { index: 15, name: 'Background Bottom', type: 'color', value: "#000000", group: 'Background' },
});

// Water shader material
class WaterMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      uniforms: {
        time: { value: 0 },
        waterColor: { value: new THREE.Color('#53B5F9') },
        waterDepthColor: { value: new THREE.Color('#2227F5') },
        flowSpeed: { value: 0.5 },
        waveIntensity: { value: 0.8 },
        highlightColor: { value: new THREE.Color('#FFFFFF') },
        highlightStrength: { value: 1.0 },
        distortionStrength: { value: 0.05 }, // New uniform for distortion strength
        uResolution: { value: new THREE.Vector2() }, // Screen resolution for distortion
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;
        uniform highp float time;
        uniform float flowSpeed;
        uniform float waveIntensity;

        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          
          // Slow, smooth wave displacement
          float t = time * flowSpeed * 0.3;
          
          // Create more complex, overlapping wave patterns for a more extreme warp
          float wave1 = sin(position.x * 1.5 + t) * cos(position.y * 1.2 + t * 0.5);
          float wave2 = cos(position.y * 1.8 + t * 0.7) * sin(position.z * 1.5 + t * 0.3);
          float wave3 = sin(position.z * 2.0 + t * 0.5) * cos(position.x * 1.7 + t);
          
          // Combine waves for a more pronounced but still smooth warping effect
          float displacement = (wave1 + wave2 + wave3) * waveIntensity * 0.3;
          
          // Apply smooth displacement along the normal
          vec3 newPosition = position + normal * displacement;
          
          vec4 worldPosition = modelMatrix * vec4(newPosition, 1.0);
          vWorldPosition = worldPosition.xyz;
          
          vec4 mvPosition = viewMatrix * worldPosition;
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform highp float time;
        uniform vec3 waterColor;
        uniform vec3 waterDepthColor;
        uniform float flowSpeed;
        uniform vec3 highlightColor;
        uniform float highlightStrength;
        uniform float distortionStrength; // New uniform
        uniform vec2 uResolution; // Screen resolution
        
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;
        
        // Hash function for random numbers
        float hash(float n) { return fract(sin(n) * 43758.5453123); }

        // Simple 2D noise function
        float noise(vec2 p) {
            vec2 ip = floor(p);
            vec2 fp = fract(p);
            fp = fp * fp * (3.0 - 2.0 * fp);
            float h00 = hash(ip.x + ip.y * 37.0);
            float h10 = hash(ip.x + 1.0 + ip.y * 37.0);
            float h01 = hash(ip.x + (ip.y + 1.0) * 37.0);
            float h11 = hash(ip.x + 1.0 + (ip.y + 1.0) * 37.0);
            return mix(mix(h00, h10, fp.x), mix(h01, h11, fp.x), fp.y);
        }

        void main() {
          // Fresnel for transparency
          vec3 viewDir = normalize(vViewPosition);
          float fresnel = 1.0 - abs(dot(vNormal, viewDir));
          fresnel = pow(fresnel, 2.0);

          // Smooth flowing patterns for color variation
          float t = time * flowSpeed * 0.2;
          float flow1 = sin(vWorldPosition.x * 3.0 + t) * 0.5 + 0.5;
          float flow2 = cos(vWorldPosition.y * 2.5 + t * 0.8) * 0.5 + 0.5;
          vec3 baseColor = mix(waterDepthColor, waterColor, flow1 * flow2);
          
          // Soft specular highlight
          vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
          vec3 reflectDir = reflect(-lightDir, vNormal);
          float spec = pow(max(dot(reflectDir, viewDir), 0.0), 16.0);
          
          // View-angle dependent highlight (Fresnel-like effect)
          // Stronger highlight when surface normal is perpendicular to view direction
          float viewAngleHighlight = pow(1.0 - max(0.0, dot(vNormal, viewDir)), 3.0);
          vec3 finalHighlight = highlightColor * viewAngleHighlight * highlightStrength;

          vec3 finalColor = baseColor + vec3(spec * 0.3) + finalHighlight;
          float alpha = mix(0.7, 0.9, fresnel);

          // Screen-space distortion (simplified)
          // This aims to create a visual effect of distortion within the object itself,
          // rather than true refraction of background objects, which is complex for a single shader.
          vec2 screenUV = gl_FragCoord.xy / uResolution;
          
          float distortionSpeed = 0.7;
          
          // Use noise to create a wavy distortion pattern
          vec2 noiseOffset = vec2(
              noise(screenUV * 10.0 + time * distortionSpeed),
              noise(screenUV * 10.0 + time * distortionSpeed + 100.0)
          ) * 2.0 - 1.0; // Scale to -1 to 1

          // Apply a subtle color shift based on the noise, scaled by distortionStrength
          vec3 distortedColor = finalColor;
          distortedColor.r += noiseOffset.x * distortionStrength;
          distortedColor.g += noiseOffset.y * distortionStrength;
          distortedColor.b -= (noiseOffset.x + noiseOffset.y) * 0.5 * distortionStrength;

          gl_FragColor = vec4(distortedColor, alpha);
        }
      `,
      transparent: true,
    });
  }
}

// Register the custom material
extend({ WaterMaterial });

// Sphere component with water material and random offsets
function WaterSphere({ size, position, timeOffset, rotationOffset }) {
  const meshRef = useRef();
  const materialRef = useRef();

  const waterColorTweak = tweaks.waterColor.useState();
  const waterDepthColorTweak = tweaks.waterDepthColor.useState();
  const flowSpeed = tweaks.flowSpeed.useState();
  const waveIntensity = tweaks.waveIntensity.useState();
  const highlightColorTweak = tweaks.highlightColor.useState();
  const highlightStrength = tweaks.highlightStrength.useState();
  const distortionStrength = tweaks.distortionStrength.useState(); // New tweak state
  
  const { size: canvasSize } = useThree(); // Get canvas size for resolution uniform

  // Create the material once and update its uniforms
  const material = useMemo(() => new WaterMaterial(), []);

  // Update material uniforms when tweak values change
  useEffect(() => {
    material.uniforms.waterColor.value.set(waterColorTweak);
  }, [waterColorTweak, material]);

  useEffect(() => {
    material.uniforms.waterDepthColor.value.set(waterDepthColorTweak);
  }, [waterDepthColorTweak, material]);

  useEffect(() => {
    material.uniforms.flowSpeed.value = flowSpeed;
  }, [flowSpeed, material]);

  useEffect(() => {
    material.uniforms.waveIntensity.value = waveIntensity;
  }, [waveIntensity, material]);

  useEffect(() => {
    material.uniforms.highlightColor.value.set(highlightColorTweak);
  }, [highlightColorTweak, material]);

  useEffect(() => {
    material.uniforms.highlightStrength.value = highlightStrength;
  }, [highlightStrength, material]);

  // Update distortion strength uniform
  useEffect(() => {
    material.uniforms.distortionStrength.value = distortionStrength;
  }, [distortionStrength, material]);

  // Update resolution uniform
  useEffect(() => {
    material.uniforms.uResolution.value.set(canvasSize.width, canvasSize.height);
  }, [canvasSize.width, canvasSize.height, material]);

  useFrame(({ clock }) => {
    // Apply time offset to each sphere individually
    material.uniforms.time.value = clock.getElapsedTime() + timeOffset;
    
    // Apply continuous rotation with random offset
    if (meshRef.current) {
      const time = clock.getElapsedTime() * 0.2;
      meshRef.current.rotation.x = time + rotationOffset.x;
      meshRef.current.rotation.y = time * 0.7 + rotationOffset.y;
      meshRef.current.rotation.z = time * 0.5 + rotationOffset.z;
    }
  });

  return (
    <mesh ref={meshRef} position={position} castShadow receiveShadow>
      <sphereGeometry args={[size, 64, 64]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

// Scene setup
function Scene() {
  const zoomLevel = tweaks.zoomLevel.useState();
  const minZoom = tweaks.minZoom.useState();
  const maxZoom = tweaks.maxZoom.useState();
  const sphereSize = tweaks.sphereSize.useState();
  const helixRadius = tweaks.helixRadius.useState();
  const helixHeight = tweaks.helixHeight.useState();
  const numSpheres = tweaks.numSpheres.useState();
  
  const { camera } = useThree();
  const targetZoom = useRef(zoomLevel);

  useEffect(() => {
    targetZoom.current = zoomLevel;
  }, [zoomLevel]);
  
  useFrame((state, delta) => {
    // Smoothly interpolate camera position for zoom
    const currentZoom = camera.position.length();
    const newZoom = THREE.MathUtils.lerp(currentZoom, targetZoom.current, 0.05);
    camera.position.setLength(newZoom);
    camera.lookAt(0, 0, 0);
  });

  // Generate spheres in a double helix
  const spheres = useMemo(() => {
    const result = [];
    const totalSpheres = Math.floor(numSpheres / 2) * 2; // Ensure even number for pairs

    // Define a bounding box or frustum to keep spheres within view
    // These values are approximate and may need adjustment based on camera FOV and zoom
    const frustumWidth = 20; // Example: adjust based on camera FOV and distance
    const frustumHeight = 20;

    for (let i = 0; i < totalSpheres; i++) {
      const isFirstHelix = i % 2 === 0;
      const angle = (i / totalSpheres) * Math.PI * 8; // Adjust rotation turns
      let y = (i / totalSpheres) * helixHeight - helixHeight / 2;

      let x = helixRadius * Math.cos(angle + (isFirstHelix ? 0 : Math.PI));
      let z = helixRadius * Math.sin(angle + (isFirstHelix ? 0 : Math.PI));

      // Clamp positions to keep spheres within a reasonable visible range
      // This prevents them from being generated too far off-screen
      x = THREE.MathUtils.clamp(x, -frustumWidth / 2, frustumWidth / 2);
      y = THREE.MathUtils.clamp(y, -frustumHeight / 2, frustumHeight / 2);
      z = THREE.MathUtils.clamp(z, -frustumWidth / 2, frustumWidth / 2); // Z is depth, so clamp similarly

      const position = [x, y, z];

      // Generate random offsets for each sphere
      const timeOffset = Math.random() * 10;
      const rotationOffset = {
        x: Math.random() * Math.PI * 2,
        y: Math.random() * Math.PI * 2,
        z: Math.random() * Math.PI * 2,
      };

      result.push(
        <WaterSphere
          key={i}
          position={position}
          size={sphereSize}
          timeOffset={timeOffset}
          rotationOffset={rotationOffset}
        />
      );
    }
    return result;
  }, [numSpheres, helixRadius, helixHeight, sphereSize]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[5, 5, 5]} 
        intensity={0.8} 
        castShadow 
        shadow-mapSize-width={1024} 
        shadow-mapSize-height={1024} 
      />
      <group>
        {spheres}
      </group>
      <OrbitControls 
        enablePan={false}
        minAzimuthAngle={-Infinity}
        maxAzimuthAngle={Infinity}
        minPolarAngle={Math.PI / 2}
        maxPolarAngle={Math.PI / 2}
        minDistance={minZoom} 
        maxDistance={maxZoom}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  );
}

export default function Component() {
  const backgroundTopColor = tweaks.backgroundTopColor.useState();
  const backgroundBottomColor = tweaks.backgroundBottomColor.useState();
  
  const handleTouchStart = () => {
    gizmoRuntime.performHaptic('light');
  };

  return (
    <>
      <div 
        aria-hidden 
        className="fixed inset-0 -z-10" 
        style={{ 
          background: `linear-gradient(to bottom, ${backgroundTopColor}, ${backgroundBottomColor})` 
        }} 
      />
      <div 
        className="h-screen w-screen touch-none"
        onTouchStart={handleTouchStart}
      >
        <Canvas 
          shadows 
          gl={{ antialias: true, alpha: true }}
          camera={{ fov: 60, near: 0.1, far: 1000 }}
        >
          {/* The scene now reads tweaks internally */}
          <Scene />
        </Canvas>
      </div>
    </>
  );
}