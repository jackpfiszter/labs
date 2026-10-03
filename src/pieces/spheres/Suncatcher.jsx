import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

const DEFAULTS = {
  ballOpacity: 1.0,
  refractionRatio: 1.34,
  dispersion: 0.2,
  rainbowStrength: 0.4,
  edgeClarity: 0.05,
  facetDetail: 1,
  rotationSpeed: 0.45,
  skyColor: "#BFBFFF",
  skyMidColor: "#FFF6D1",
  horizonColor: "#FFBF9D",
  cloudColor: "#FF9884",
  cloudHighlight: "#E6E6CA",
  cloudShadow: "#99A7E6",
  sunColor: "#FFF9E3",
  cloudDensity: 0.5,
  cameraDistance: 15.0,
  cameraOrbit: 319.0,
};

const ProceduralEnvShader = {
  uniforms: {
    uTime: { value: 0 },
    uSkyColor: { value: new THREE.Color('#FF6B6B') },
    uSkyMidColor: { value: new THREE.Color('#FF8E53') },
    uHorizonColor: { value: new THREE.Color('#6C5CE7') },
    uCloudColor: { value: new THREE.Color('#FFD93D') },
    uCloudHighlight: { value: new THREE.Color('#FFFFFF') },
    uCloudShadow: { value: new THREE.Color('#4A3B52') },
    uSunColor: { value: new THREE.Color('#FFF9E3') },
    uCloudDensity: { value: 0.45 },
  },
  vertexShader: `
    varying vec3 vWorldDirection;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldDirection = normalize(worldPosition.xyz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform float uTime;
    uniform vec3 uSkyColor;
    uniform vec3 uSkyMidColor;
    uniform vec3 uHorizonColor;
    uniform vec3 uCloudColor;
    uniform vec3 uCloudHighlight;
    uniform vec3 uCloudShadow;
    uniform vec3 uSunColor;
    uniform float uCloudDensity;
    varying vec3 vWorldDirection;

    float hash(float n) { return fract(sin(n) * 43758.5453123); }

    float noise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float n = dot(i, vec3(1.0, 57.0, 113.0));
      return mix(mix(mix(hash(n + 0.0), hash(n + 1.0), f.x), mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
                 mix(mix(hash(n + 113.0), hash(n + 114.0), f.x), mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
    }

    float fbm(vec3 p) {
      float v = 0.0; float a = 0.5;
      for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
      return v;
    }

    void main() {
      vec3 dir = normalize(vWorldDirection);
      float h = dir.y * 0.5 + 0.5;

      vec3 sky;
      if (h < 0.5) {
        sky = mix(uHorizonColor, uSkyMidColor, h * 2.0);
      } else {
        sky = mix(uSkyMidColor, uSkyColor, (h - 0.5) * 2.0);
      }

      vec3 sunDir = normalize(vec3(0.5, 0.3, -1.0));
      float sunDot = max(0.0, dot(dir, sunDir));
      float sun = pow(sunDot, 800.0) * 2.0;
      float sunGlow = pow(sunDot, 10.0) * 0.5;
      sky += uSunColor * (sun + sunGlow);

      vec3 cloudPos = dir * 2.5;
      cloudPos.x += uTime * 0.02;
      cloudPos.z += uTime * 0.01;
      float f = fbm(cloudPos + fbm(cloudPos + uTime * 0.01));
      float cloudMask = smoothstep(1.0 - uCloudDensity, 1.1 - uCloudDensity, f);
      cloudMask *= smoothstep(0.0, 0.2, h) * smoothstep(1.0, 0.8, h);

      float cloudLight = pow(max(0.0, dot(dir, sunDir)), 2.0);
      float cloudShadow = pow(max(0.0, dot(dir, -sunDir)), 1.5);
      vec3 finalCloudColor = mix(uCloudColor, uCloudHighlight, cloudLight * f);
      finalCloudColor = mix(finalCloudColor, uCloudShadow, cloudShadow * f);

      gl_FragColor = vec4(mix(sky, finalCloudColor, cloudMask * 0.8), 1.0);
    }
  `
};

const CrystalBallShader = {
  uniforms: {
    uTime: { value: 0 },
    uOpacity: { value: 0.8 },
    uRefractionRatio: { value: 0.98 },
    uDispersion: { value: 0.05 },
    uRainbowStrength: { value: 0.6 },
    uEdgeClarity: { value: 0.8 },
    uSkyColor: { value: new THREE.Color('#FF6B6B') },
    uSkyMidColor: { value: new THREE.Color('#FF8E53') },
    uHorizonColor: { value: new THREE.Color('#6C5CE7') },
    uCloudColor: { value: new THREE.Color('#FFD93D') },
    uCloudHighlight: { value: new THREE.Color('#FFFFFF') },
    uCloudShadow: { value: new THREE.Color('#4A3B52') },
    uSunColor: { value: new THREE.Color('#FFF9E3') },
    uCloudDensity: { value: 0.45 },
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    varying vec3 vViewDir;

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vViewDir = normalize(worldPosition.xyz - cameraPosition);
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform float uTime;
    uniform float uOpacity;
    uniform float uRefractionRatio;
    uniform float uDispersion;
    uniform float uRainbowStrength;
    uniform float uEdgeClarity;
    uniform vec3 uSkyColor;
    uniform vec3 uSkyMidColor;
    uniform vec3 uHorizonColor;
    uniform vec3 uCloudColor;
    uniform vec3 uCloudHighlight;
    uniform vec3 uCloudShadow;
    uniform vec3 uSunColor;
    uniform float uCloudDensity;

    varying vec3 vWorldPosition;
    varying vec3 vViewDir;

    float hash(float n) { return fract(sin(n) * 43758.5453123); }
    float noise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float n = dot(i, vec3(1.0, 57.0, 113.0));
      return mix(mix(mix(hash(n + 0.0), hash(n + 1.0), f.x), mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
                 mix(mix(hash(n + 113.0), hash(n + 114.0), f.x), mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
    }
    float fbm(vec3 p) {
      float v = 0.0; float a = 0.5;
      for (int i = 0; i < 3; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
      return v;
    }

    vec3 getEnv(vec3 dir) {
      float h = dir.y * 0.5 + 0.5;
      vec3 sky;
      if (h < 0.5) {
        sky = mix(uHorizonColor, uSkyMidColor, h * 2.0);
      } else {
        sky = mix(uSkyMidColor, uSkyColor, (h - 0.5) * 2.0);
      }

      vec3 sunDir = normalize(vec3(0.5, 0.3, -1.0));
      float sunDot = max(0.0, dot(dir, sunDir));
      sky += uSunColor * (pow(sunDot, 800.0) * 2.0 + pow(sunDot, 10.0) * 0.5);

      vec3 cloudPos = dir * 2.5;
      cloudPos.x += uTime * 0.02;
      float f = fbm(cloudPos);
      float cloudMask = smoothstep(1.0 - uCloudDensity, 1.1 - uCloudDensity, f);

      float cloudLight = pow(max(0.0, dot(dir, sunDir)), 2.0);
      float cloudShadow = pow(max(0.0, dot(dir, -sunDir)), 1.5);
      vec3 finalCloudColor = mix(uCloudColor, uCloudHighlight, cloudLight * f);
      finalCloudColor = mix(finalCloudColor, uCloudShadow, cloudShadow * f);
      return mix(sky, finalCloudColor, cloudMask * 0.8);
    }

    vec3 rainbow(float t) {
      return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
    }

    void main() {
      vec3 fdx = dFdx(vWorldPosition);
      vec3 fdy = dFdy(vWorldPosition);
      vec3 flatNormal = normalize(cross(fdx, fdy));
      vec3 viewDir = normalize(vViewDir);

      vec3 refractR = refract(viewDir, flatNormal, uRefractionRatio);
      vec3 refractG = refract(viewDir, flatNormal, uRefractionRatio + uDispersion * 0.5);
      vec3 refractB = refract(viewDir, flatNormal, uRefractionRatio + uDispersion);

      vec3 refractColor = vec3(getEnv(refractR).r, getEnv(refractG).g, getEnv(refractB).b);

      vec3 reflectDir = reflect(viewDir, flatNormal);
      vec3 reflectColor = getEnv(reflectDir);

      float fresnelPower = mix(1.0, 8.0, uEdgeClarity);
      float fresnel = pow(1.0 - max(0.0, dot(-viewDir, flatNormal)), fresnelPower);

      float diffraction = dot(flatNormal, -viewDir);
      vec3 rainbowColor = rainbow(diffraction * 2.0 + uTime * 0.05);

      float mist = fbm(vWorldPosition * 1.2 + uTime * 0.05);
      float mistStrength = mix(0.2, 0.02, uEdgeClarity);
      vec3 magicColor = mix(vec3(1.0), rainbowColor, mist * uRainbowStrength * mistStrength);

      vec3 finalColor = mix(refractColor, reflectColor, fresnel);

      float backFacetLight = pow(max(0.0, dot(reflectDir, vec3(0.0, -1.0, 0.0))), 12.0);
      finalColor += rainbowColor * backFacetLight * uRainbowStrength;

      float edgeMask = pow(1.0 - max(0.0, dot(flatNormal, -viewDir)), 2.0);
      float magicMix = mix(0.1, 0.01, uEdgeClarity * edgeMask);
      finalColor = mix(finalColor, finalColor + magicColor * 0.2, magicMix);

      finalColor += rainbowColor * fresnel * uRainbowStrength * 0.4 * (1.0 - uEdgeClarity * 0.5);

      finalColor = max(finalColor, refractColor * 0.9);

      gl_FragColor = vec4(finalColor, uOpacity);
    }
  `
};

function ProceduralBackground() {
  const skyColor = DEFAULTS.skyColor;
  const skyMidColor = DEFAULTS.skyMidColor;
  const horizonColor = DEFAULTS.horizonColor;
  const cloudColor = DEFAULTS.cloudColor;
  const cloudHighlight = DEFAULTS.cloudHighlight;
  const cloudShadow = DEFAULTS.cloudShadow;
  const sunColor = DEFAULTS.sunColor;
  const cloudDensity = DEFAULTS.cloudDensity;

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(ProceduralEnvShader.uniforms),
      vertexShader: ProceduralEnvShader.vertexShader,
      fragmentShader: ProceduralEnvShader.fragmentShader,
      side: THREE.BackSide,
    });
  }, []);

  useFrame((state) => {
    if (material) {
      material.uniforms.uTime.value = state.clock.elapsedTime;
      material.uniforms.uSkyColor.value.set(skyColor);
      material.uniforms.uSkyMidColor.value.set(skyMidColor);
      material.uniforms.uHorizonColor.value.set(horizonColor);
      material.uniforms.uCloudColor.value.set(cloudColor);
      material.uniforms.uCloudHighlight.value.set(cloudHighlight);
      material.uniforms.uCloudShadow.value.set(cloudShadow);
      material.uniforms.uSunColor.value.set(sunColor);
      material.uniforms.uCloudDensity.value = cloudDensity;
    }
  });

  return (
    <mesh>
      <sphereGeometry args={[50, 32, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function CrystalBall() {
  const groupRef = useRef(null);
  const materialRef = useRef(null);

  const ballOpacity = DEFAULTS.ballOpacity;
  const refractionRatio = DEFAULTS.refractionRatio;
  const dispersion = DEFAULTS.dispersion;
  const rainbowStrength = DEFAULTS.rainbowStrength;
  const edgeClarity = DEFAULTS.edgeClarity;
  const rotationSpeed = DEFAULTS.rotationSpeed;
  const facetDetail = DEFAULTS.facetDetail;

  const skyColor = DEFAULTS.skyColor;
  const skyMidColor = DEFAULTS.skyMidColor;
  const horizonColor = DEFAULTS.horizonColor;
  const cloudColor = DEFAULTS.cloudColor;
  const cloudHighlight = DEFAULTS.cloudHighlight;
  const cloudShadow = DEFAULTS.cloudShadow;
  const sunColor = DEFAULTS.sunColor;
  const cloudDensity = DEFAULTS.cloudDensity;

  const uniforms = useMemo(() => THREE.UniformsUtils.clone(CrystalBallShader.uniforms), []);

  useFrame((state, delta) => {
    if (groupRef.current) {
      const t = state.clock.elapsedTime * rotationSpeed;
      groupRef.current.rotation.x = Math.sin(t * 0.7) * 0.5;
      groupRef.current.rotation.y += delta * rotationSpeed;
      groupRef.current.rotation.z = Math.cos(t * 0.5) * 0.5;
    }
    if (materialRef.current) {
      const u = materialRef.current.uniforms;
      u.uTime.value = state.clock.elapsedTime;
      u.uOpacity.value = ballOpacity;
      u.uRefractionRatio.value = refractionRatio;
      u.uDispersion.value = dispersion;
      u.uRainbowStrength.value = rainbowStrength;
      u.uEdgeClarity.value = edgeClarity;
      u.uSkyColor.value.set(skyColor);
      u.uSkyMidColor.value.set(skyMidColor);
      u.uHorizonColor.value.set(horizonColor);
      u.uCloudColor.value.set(cloudColor);
      u.uCloudHighlight.value.set(cloudHighlight);
      u.uCloudShadow.value.set(cloudShadow);
      u.uSunColor.value.set(sunColor);
      u.uCloudDensity.value = cloudDensity;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <icosahedronGeometry args={[2.2, facetDetail]} />
        <shaderMaterial
          ref={materialRef}
          fragmentShader={CrystalBallShader.fragmentShader}
          vertexShader={CrystalBallShader.vertexShader}
          uniforms={uniforms}
          transparent={true}
          depthWrite={false}
          extensions={{ derivatives: true }}
        />
      </mesh>
      <mesh scale={0.95}>
        <icosahedronGeometry args={[2.2, Math.max(0, facetDetail - 1)]} />
        <meshStandardMaterial
          color="#FFFFFF"
          emissive="#FFFFFF"
          emissiveIntensity={0.1}
          transparent
          opacity={0.1}
          flatShading={true}
        />
      </mesh>
    </group>
  );
}

export default function Component() {
  const cameraDistance = DEFAULTS.cameraDistance;
  const cameraOrbit = DEFAULTS.cameraOrbit;

  const cameraPosition = useMemo(() => {
    const angle = (cameraOrbit * Math.PI) / 180;
    return [
      Math.sin(angle) * cameraDistance,
      0,
      Math.cos(angle) * cameraDistance
    ];
  }, [cameraDistance, cameraOrbit]);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' }}>
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ width: '100%', height: '100%' }}>
        <PerspectiveCamera makeDefault position={cameraPosition} />
        <OrbitControls enablePan={false} minDistance={3} maxDistance={20} />
        <Suspense fallback={null}>
          <ProceduralBackground />
          <CrystalBall />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
        </Suspense>
      </Canvas>
    </div>
  );
}
