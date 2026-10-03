import React, { useRef, useEffect, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as Tone from 'tone';
import * as THREE from 'three';
import { gizmoRuntime } from '@gizmo/runtime';
import FitFov from './FitFov.js';
// The pop originally streamed from content.gizmo.party, which doesn't allow cross-origin requests.
import popSoundUrl from './bubble-pop.m4a';

const tweaks = gizmoRuntime.tweaks({
  iridescenceStrength: { index: 0, name: 'Iridescence Intensity', type: 'slider', value: 2.0, min: 0.0, max: 2.0, step: 0.1 },
  roughness: { index: 1, name: 'Surface Roughness', type: 'slider', value: 0.0, min: 0.0, max: 1.0, step: 0.05 },
  rotationSpeed: { index: 2, name: 'Auto Rotation Speed', type: 'slider', value: 0.0, min: 0.0, max: 2.0, step: 0.1 },
  backgroundColor: { index: 3, name: 'Background', type: 'color', value: "#000000" },
  gradientColor1: { index: 22, name: 'Gradient Start', type: 'color', value: "#001E22" },
  gradientColor2: { index: 23, name: 'Gradient End', type: 'color', value: "#010011" },
  highlightColor: { index: 24, name: 'Highlight Color', type: 'color', value: "#FFFFFF" },
  highlightIntensity: { index: 25, name: 'Highlight Intensity', type: 'slider', value: 0.7, min: 0.0, max: 5.0, step: 0.1 },
  highlightSharpness: { index: 26, name: 'Highlight Sharpness', type: 'slider', value: 10.0, min: 0.1, max: 10.0, step: 0.1 },
  primaryColor: { index: 4, name: 'Primary Iridescent', type: 'color', value: "#FF00FD" },
  secondaryColor: { index: 5, name: 'Secondary Iridescent', type: 'color', value: "#009DFF" },
  accentColor: { index: 6, name: 'Accent Iridescent', type: 'color', value: "#00FA67" },
  lightIntensity: { index: 7, name: 'Light Intensity', type: 'slider', value: 3.0, min: 0.2, max: 3.0, step: 0.1 },
  vortexStrength1: { index: 8, name: 'Vortex 1 Strength', type: 'slider', value: 0.25, min: 0.0, max: 1.0, step: 0.05 },
  vortexDensity1: { index: 9, name: 'Vortex 1 Density', type: 'slider', value: 0.5, min: 0.5, max: 5.0, step: 0.1 },
  vortexStrength2: { index: 10, name: 'Vortex 2 Strength', type: 'slider', value: 0.1, min: 0.0, max: 1.0, step: 0.05 },
  vortexDensity2: { index: 11, name: 'Vortex 2 Density', type: 'slider', value: 0.8, min: 0.5, max: 10.0, step: 0.1 },
  swirlColor: { index: 12, name: 'Swirl Color', type: 'color', value: "#FFEA00" },
  vortexStrength3: { index: 13, name: 'Swirl Strength', type: 'slider', value: 0.15, min: 0.0, max: 1.0, step: 0.05 },
  vortexDensity3: { index: 14, name: 'Swirl Density', type: 'slider', value: 3.0, min: 0.5, max: 10.0, step: 0.1 },
  transparency: { index: 15, name: 'Transparency', type: 'slider', value: 1.0, min: 0.0, max: 1.0, step: 0.05 },
  floatSpeed: { index: 16, name: 'Float Speed', type: 'slider', value: 0.5, min: 0.0, max: 0.5, step: 0.01 },
  spinSpeedX: { index: 17, name: 'Horizontal Spin', type: 'slider', value: 0.2, min: 0.0, max: 1.0, step: 0.05 },
  spinSpeedY: { index: 18, name: 'Vertical Spin', type: 'slider', value: 0.25, min: 0.0, max: 1.0, step: 0.05 },
  vortexSpeed1: { index: 19, name: 'Vortex 1 Speed', type: 'slider', value: 0.2, min: 0.0, max: 1.0, step: 0.05 },
  vortexSpeed2: { index: 20, name: 'Vortex 2 Speed', type: 'slider', value: 0.15, min: 0.0, max: 1.0, step: 0.05 },
  swirlSpeed: { index: 21, name: 'Swirl Speed', type: 'slider', value: 0.3, min: 0.0, max: 1.0, step: 0.05 },
  respawnDelay: { index: 27, name: 'Respawn Delay (s)', type: 'slider', value: 1.0, min: 0.5, max: 10.0, step: 0.5 },
});

const IridescentSphere = ({
  iridescenceStrength,
  roughness,
  rotationSpeed,
  primaryColor,
  secondaryColor,
  accentColor,
  lightIntensity,
  vortexStrength1,
  vortexDensity1,
  vortexStrength2,
  vortexDensity2,
  swirlColor,
  vortexStrength3,
  vortexDensity3,
  userRotation,
  transparency,
  floatSpeed,
  spinSpeedX,
  spinSpeedY,
  vortexSpeed1,
  vortexSpeed2,
  swirlSpeed,
  highlightColor,
  highlightIntensity,
  highlightSharpness,
  isBubbleVisible,
  onBubbleTap,
  onBubbleHover
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const scaleRef = useRef(0);
  const autoRotationY = useRef(0);
  const spinRef = useRef({ x: 0, y: 0 });
  const smoothedRotation = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (isBubbleVisible) {
      scaleRef.current = 0; // Reset scale to 0 when bubble becomes visible
    }
  }, [isBubbleVisible]);
  
  // Convert hex colors to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex);
    return result ? new THREE.Vector3(
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ) : new THREE.Vector3(1, 1, 1);
  };

  // Iridescence vertex shader
  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vViewPosition;
    
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  // Iridescence fragment shader
  const fragmentShader = `
    precision mediump float;
    
    uniform float u_time;
    uniform float u_iridescenceStrength;
    uniform float u_roughness;
    uniform float u_lightIntensity;
    uniform vec3 u_primaryColor;
    uniform vec3 u_secondaryColor;
    uniform vec3 u_accentColor;
    uniform vec3 u_lightPosition;
    uniform float u_vortexStrength1;
    uniform float u_vortexDensity1;
    uniform float u_vortexStrength2;
    uniform float u_vortexDensity2;
    uniform vec3 u_swirlColor;
    uniform float u_vortexStrength3;
    uniform float u_vortexDensity3;
    uniform float u_transparency;
    uniform float u_vortexSpeed1;
    uniform float u_vortexSpeed2;
    uniform float u_swirlSpeed;
    uniform vec3 u_highlightColor;
    uniform float u_highlightIntensity;
    uniform float u_highlightSharpness;
    
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vViewPosition;

    // Simplex noise functions
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
    }

    vec3 snoiseVec3(vec3 x) {
      float s = snoise(vec3(x));
      float s1 = snoise(vec3(x.y - 19.1, x.z + 33.4, x.x + 47.2));
      float s2 = snoise(vec3(x.z + 74.2, x.x - 124.5, x.y + 99.4));
      return vec3(s, s1, s2);
    }

    vec3 curlNoise(vec3 p) {
      const float e = 0.1;
      vec3 dx = vec3(e, 0.0, 0.0);
      vec3 dy = vec3(0.0, e, 0.0);
      vec3 dz = vec3(0.0, 0.0, e);
      vec3 p_x0 = snoiseVec3(p - dx);
      vec3 p_x1 = snoiseVec3(p + dx);
      vec3 p_y0 = snoiseVec3(p - dy);
      vec3 p_y1 = snoiseVec3(p + dy);
      vec3 p_z0 = snoiseVec3(p - dz);
      vec3 p_z1 = snoiseVec3(p + dz);
      float x = p_y1.z - p_y0.z - p_z1.y + p_z0.y;
      float y = p_z1.x - p_z0.x - p_x1.z + p_x0.z;
      float z = p_x1.y - p_x0.y - p_y1.x + p_y0.x;
      const float divisor = 1.0 / (2.0 * e);
      return normalize(vec3(x, y, z) * divisor);
    }
    
    vec3 getIridescence(vec3 normal, vec3 viewDir, float strength) {
      // Calculate fresnel effect
      float fresnel = dot(normal, viewDir);
      fresnel = 1.0 - abs(fresnel);
      fresnel = pow(fresnel, 2.0);
      
      // Create color shifts based on angle
      float colorShift = fresnel * strength;
      
      // Mix between the three iridescent colors
      vec3 color1 = mix(u_primaryColor, u_secondaryColor, sin(colorShift * 3.14159 + u_time * 0.5) * 0.5 + 0.5);
      vec3 color2 = mix(u_secondaryColor, u_accentColor, cos(colorShift * 2.0 + u_time * 0.3) * 0.5 + 0.5);
      
      return mix(color1, color2, fresnel);
    }
    
    void main() {
      vec3 normal = normalize(vNormal);

      // Add swirling displacement layer 1
      vec3 noisePos1 = vPosition * u_vortexDensity1;
      vec3 curl1 = curlNoise(noisePos1 + u_time * u_vortexSpeed1);
      normal = normalize(normal + curl1 * u_vortexStrength1);

      // Add swirling displacement layer 2
      vec3 noisePos2 = vPosition * u_vortexDensity2;
      vec3 curl2 = curlNoise(noisePos2 - u_time * u_vortexSpeed2); // Move in a different direction
      normal = normalize(normal + curl2 * u_vortexStrength2);

      // Add wispy yellow swirls (layer 3)
      vec3 noisePos3 = vPosition * u_vortexDensity3;
      vec3 swirlCurl = curlNoise(noisePos3 + u_time * u_swirlSpeed);
      float swirlNoise = snoise(noisePos3 + swirlCurl * 0.5 + u_time * u_swirlSpeed);
      float swirlMask = smoothstep(0.3, 0.7, swirlNoise);
      vec3 swirlColorMix = u_swirlColor * swirlMask * u_vortexStrength3;

      vec3 viewDir = normalize(vViewPosition);
      vec3 lightDir = normalize(u_lightPosition - vPosition);
      
      // Base iridescent color
      vec3 iridescent = getIridescence(normal, viewDir, u_iridescenceStrength);
      
      // Simple lighting
      float NdotL = max(dot(normal, lightDir), 0.0);
      float ambient = 0.3;
      float lighting = ambient + NdotL * u_lightIntensity;

      // Add specular highlight for a wet/reflective look
      vec3 reflectDir = reflect(-lightDir, normal);
      float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
      vec3 specular = vec3(1.0) * spec * u_lightIntensity * 1.5;
      
      // Apply roughness
      float roughnessFactor = 1.0 - u_roughness * 0.5;
      iridescent *= roughnessFactor;
      
      // Final color with lighting and specular
      vec3 finalColor = (iridescent + swirlColorMix) * lighting + specular;

      // Calculate fresnel for transparency
      float fresnel = 1.0 - abs(dot(normal, viewDir));
      fresnel = pow(fresnel, 1.5);
      float alpha = mix(0.1, 1.0, fresnel) * u_transparency;

      // Add static screen-space highlight
      float highlightFresnel = 1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition)));
      highlightFresnel = pow(highlightFresnel, u_highlightSharpness);
      vec3 highlight = u_highlightColor * highlightFresnel * u_highlightIntensity;
      
      gl_FragColor = vec4(finalColor + highlight, alpha);
    }
  `;

  // Create shader material once (uniforms are refreshed from props every frame below)
  const shaderMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      u_time: { value: 0 },
      u_iridescenceStrength: { value: iridescenceStrength },
      u_roughness: { value: roughness },
      u_lightIntensity: { value: lightIntensity },
      u_primaryColor: { value: hexToRgb(primaryColor) },
      u_secondaryColor: { value: hexToRgb(secondaryColor) },
      u_accentColor: { value: hexToRgb(accentColor) },
      u_lightPosition: { value: new THREE.Vector3(5, 5, 5) },
      u_vortexStrength1: { value: vortexStrength1 },
      u_vortexDensity1: { value: vortexDensity1 },
      u_vortexStrength2: { value: vortexStrength2 },
      u_vortexDensity2: { value: vortexDensity2 },
      u_swirlColor: { value: hexToRgb(swirlColor) },
      u_vortexStrength3: { value: vortexStrength3 },
      u_vortexDensity3: { value: vortexDensity3 },
      u_transparency: { value: transparency },
      u_vortexSpeed1: { value: vortexSpeed1 },
      u_vortexSpeed2: { value: vortexSpeed2 },
      u_swirlSpeed: { value: swirlSpeed },
      u_highlightColor: { value: hexToRgb(highlightColor) },
      u_highlightIntensity: { value: highlightIntensity },
      u_highlightSharpness: { value: highlightSharpness },
    },
    transparent: true,
    depthWrite: false,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => shaderMaterial.dispose(), [shaderMaterial]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.u_time.value = state.clock.elapsedTime;
      materialRef.current.uniforms.u_iridescenceStrength.value = iridescenceStrength;
      materialRef.current.uniforms.u_roughness.value = roughness;
      materialRef.current.uniforms.u_lightIntensity.value = lightIntensity;
      materialRef.current.uniforms.u_primaryColor.value = hexToRgb(primaryColor);
      materialRef.current.uniforms.u_secondaryColor.value = hexToRgb(secondaryColor);
      materialRef.current.uniforms.u_accentColor.value = hexToRgb(accentColor);
      materialRef.current.uniforms.u_vortexStrength1.value = vortexStrength1;
      materialRef.current.uniforms.u_vortexDensity1.value = vortexDensity1;
      materialRef.current.uniforms.u_vortexStrength2.value = vortexStrength2;
      materialRef.current.uniforms.u_vortexDensity2.value = vortexDensity2;
      materialRef.current.uniforms.u_swirlColor.value = hexToRgb(swirlColor);
      materialRef.current.uniforms.u_vortexStrength3.value = vortexStrength3;
      materialRef.current.uniforms.u_vortexDensity3.value = vortexDensity3;
      materialRef.current.uniforms.u_transparency.value = transparency;
      materialRef.current.uniforms.u_vortexSpeed1.value = vortexSpeed1;
      materialRef.current.uniforms.u_vortexSpeed2.value = vortexSpeed2;
      materialRef.current.uniforms.u_swirlSpeed.value = swirlSpeed;
      materialRef.current.uniforms.u_highlightColor.value = hexToRgb(highlightColor);
      materialRef.current.uniforms.u_highlightIntensity.value = highlightIntensity;
      materialRef.current.uniforms.u_highlightSharpness.value = highlightSharpness;
    }
    
    if (meshRef.current) {
      // Auto rotation
      autoRotationY.current += rotationSpeed * 0.01;

      // Smooth random spin
      spinRef.current.x += (Math.sin(state.clock.elapsedTime * 0.3) * spinSpeedX * 0.02);
      spinRef.current.y += (Math.cos(state.clock.elapsedTime * 0.4) * spinSpeedY * 0.02);

      // Floating motion
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * floatSpeed * 2.0) * 0.1;
      meshRef.current.position.x = Math.cos(state.clock.elapsedTime * floatSpeed) * 0.1;
      
      // Apply user and auto rotation with damping
      smoothedRotation.current.x = THREE.MathUtils.lerp(smoothedRotation.current.x, userRotation.x, 0.1);
      smoothedRotation.current.y = THREE.MathUtils.lerp(smoothedRotation.current.y, userRotation.y, 0.1);

      meshRef.current.rotation.x = smoothedRotation.current.x + spinRef.current.x;
      meshRef.current.rotation.y = smoothedRotation.current.y + autoRotationY.current + spinRef.current.y;

      // Animate scale up from nothing when visible
      if (scaleRef.current < 1) {
        scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, 1, 0.1);
      }
      meshRef.current.scale.set(scaleRef.current, scaleRef.current, scaleRef.current);
    }
  });

  if (!isBubbleVisible) {
    return null;
  }

  return (
    <mesh
      ref={meshRef}
      onClick={onBubbleTap}
      onPointerOver={() => onBubbleHover(true)}
      onPointerOut={() => onBubbleHover(false)}
    >
      <sphereGeometry args={[2, 64, 32]} />
      <primitive object={shaderMaterial} ref={materialRef} attach="material" />
    </mesh>
  );
};

const Scene = ({
  iridescenceStrength,
  roughness,
  rotationSpeed,
  primaryColor,
  secondaryColor,
  accentColor,
  lightIntensity,
  vortexStrength1,
  vortexDensity1,
  vortexStrength2,
  vortexDensity2,
  swirlColor,
  vortexStrength3,
  vortexDensity3,
  userRotation,
  transparency,
  floatSpeed,
  spinSpeedX,
  spinSpeedY,
  vortexSpeed1,
  vortexSpeed2,
  swirlSpeed,
  highlightColor,
  highlightIntensity,
  highlightSharpness,
  isBubbleVisible,
  onBubbleTap,
  onBubbleHover
}) => {
  return (
    <>
      <ambientLight intensity={0.2} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <pointLight position={[-5, -5, 5]} intensity={0.5} color="#53B5F9" />
      
      <Suspense fallback={
        <mesh>
          <sphereGeometry args={[2, 32, 16]} />
          <meshStandardMaterial color="#63d9d7" />
        </mesh>
      }>
        <IridescentSphere 
          iridescenceStrength={iridescenceStrength}
          roughness={roughness}
          rotationSpeed={rotationSpeed}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          accentColor={accentColor}
          lightIntensity={lightIntensity}
          vortexStrength1={vortexStrength1}
          vortexDensity1={vortexDensity1}
          vortexStrength2={vortexStrength2}
          vortexDensity2={vortexDensity2}
          swirlColor={swirlColor}
          vortexStrength3={vortexStrength3}
          vortexDensity3={vortexDensity3}
          userRotation={userRotation}
          transparency={transparency}
          floatSpeed={floatSpeed}
          spinSpeedX={spinSpeedX}
          spinSpeedY={spinSpeedY}
          vortexSpeed1={vortexSpeed1}
          vortexSpeed2={vortexSpeed2}
          swirlSpeed={swirlSpeed}
          highlightColor={highlightColor}
          highlightIntensity={highlightIntensity}
          highlightSharpness={highlightSharpness}
          isBubbleVisible={isBubbleVisible}
          onBubbleTap={onBubbleTap}
          onBubbleHover={onBubbleHover}
        />
      </Suspense>
    </>
  );
};

export default function Component() {
  const [userRotation, setUserRotation] = useState({ x: 0, y: 0 });
  const [isBubbleVisible, setIsBubbleVisible] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [isBubbleHovered, setIsBubbleHovered] = useState(false);
  const popSoundPlayer = useRef<Tone.Player | null>(null);
  const respawnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTouch = useRef({ x: 0, y: 0 });
  
  const iridescenceStrength = tweaks.iridescenceStrength.useState();
  const roughness = tweaks.roughness.useState();
  const rotationSpeed = tweaks.rotationSpeed.useState();
  const backgroundColor = tweaks.backgroundColor.useState();
  const gradientColor1 = tweaks.gradientColor1.useState();
  const gradientColor2 = tweaks.gradientColor2.useState();
  const highlightColor = tweaks.highlightColor.useState();
  const highlightIntensity = tweaks.highlightIntensity.useState();
  const highlightSharpness = tweaks.highlightSharpness.useState();
  const primaryColor = tweaks.primaryColor.useState();
  const secondaryColor = tweaks.secondaryColor.useState();
  const accentColor = tweaks.accentColor.useState();
  const lightIntensity = tweaks.lightIntensity.useState();
  const vortexStrength1 = tweaks.vortexStrength1.useState();
  const vortexDensity1 = tweaks.vortexDensity1.useState();
  const vortexStrength2 = tweaks.vortexStrength2.useState();
  const vortexDensity2 = tweaks.vortexDensity2.useState();
  const swirlColor = tweaks.swirlColor.useState();
  const vortexStrength3 = tweaks.vortexStrength3.useState();
  const vortexDensity3 = tweaks.vortexDensity3.useState();
  const transparency = tweaks.transparency.useState();
  const floatSpeed = tweaks.floatSpeed.useState();
  const spinSpeedX = tweaks.spinSpeedX.useState();
  const spinSpeedY = tweaks.spinSpeedY.useState();
  const vortexSpeed1 = tweaks.vortexSpeed1.useState();
  const vortexSpeed2 = tweaks.vortexSpeed2.useState();
  const swirlSpeed = tweaks.swirlSpeed.useState();
  const respawnDelay = tweaks.respawnDelay.useState();

  // Pointer events cover both touch drags and mouse drags.
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setIsDragging(true);
    lastTouch.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !e.isPrimary) return;
    
    const deltaX = e.clientX - lastTouch.current.x;
    const deltaY = e.clientY - lastTouch.current.y;
    
    setUserRotation(prev => {
      const newX = prev.x + deltaY * 0.01;
      const clampedX = Math.max(-1.5, Math.min(1.5, newX)); // Clamp pitch to avoid flipping
      return {
        x: clampedX,
        y: prev.y + deltaX * 0.01
      };
    });
    
    lastTouch.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    setIsDragging(false);
  };

  const resetRotation = () => {
    setUserRotation({ x: 0, y: 0 });
  };

  useEffect(() => {
    popSoundPlayer.current = new Tone.Player(popSoundUrl).toDestination();
    return () => {
      popSoundPlayer.current?.dispose();
      popSoundPlayer.current = null;
      if (respawnTimer.current) clearTimeout(respawnTimer.current);
    };
  }, []);

  const handleBubbleTap = (e) => {
    // A drag that happens to end over the bubble is a spin, not a tap.
    if (e?.delta > 10) return;
    // Audio unlocks on this first tap/click; the pop never waits on it.
    const audio = isAudioReady ? Promise.resolve() : Tone.start().then(() => setIsAudioReady(true));
    audio.then(() => {
      if (popSoundPlayer.current?.loaded) popSoundPlayer.current.start();
    });
    gizmoRuntime.performHaptic('light');
    setIsBubbleVisible(false);
    setIsBubbleHovered(false);
    respawnTimer.current = setTimeout(() => {
      setIsBubbleVisible(true);
    }, respawnDelay * 1000);
  };

  return (
    <>
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: `radial-gradient(circle at center, ${gradientColor1} 0%, ${gradientColor2} 100%)` }} />
      <div className="h-full w-full relative overflow-hidden" style={{ cursor: isBubbleHovered && !isDragging ? 'pointer' : isDragging ? 'grabbing' : 'grab' }}>
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 0, 8], fov: 50 }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="touch-none"
        >
          <FitFov fov={50} minAspect={0.65} />
          <Scene 
            iridescenceStrength={iridescenceStrength}
            roughness={roughness}
            rotationSpeed={rotationSpeed}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            accentColor={accentColor}
            lightIntensity={lightIntensity}
            vortexStrength1={vortexStrength1}
            vortexDensity1={vortexDensity1}
            vortexStrength2={vortexStrength2}
            vortexDensity2={vortexDensity2}
            swirlColor={swirlColor}
            vortexStrength3={vortexStrength3}
            vortexDensity3={vortexDensity3}
            userRotation={userRotation}
            transparency={transparency}
            floatSpeed={floatSpeed}
            spinSpeedX={spinSpeedX}
            spinSpeedY={spinSpeedY}
            vortexSpeed1={vortexSpeed1}
            vortexSpeed2={vortexSpeed2}
            swirlSpeed={swirlSpeed}
            highlightColor={highlightColor}
            highlightIntensity={highlightIntensity}
            highlightSharpness={highlightSharpness}
            isBubbleVisible={isBubbleVisible}
            onBubbleTap={handleBubbleTap}
            onBubbleHover={setIsBubbleHovered}
          />
        </Canvas>
        
      </div>
    </>
  );
}