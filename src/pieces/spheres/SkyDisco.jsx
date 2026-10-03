import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
const tweaks = {
  ballColor: '#FFFFFF',
  rotationSpeed: 0.2,
  facetSize: 31.0,
  stringColor: '#000000',
  stringVisible: true,
  stringThickness: 0.01,
  skyColor: '#53B5F9',
  cloudColor: '#FFFFFF',
  horizonColor: '#FFFFFF',
  cloudDensity: 0.5,
  glintIntensity: 0.1,
  glintSize: 0.9,
  sparkleIntensity: 2.9,
  sparkleSize: 0.99,
  sideSparkleIntensity: 0.3,
  shadowShimmerIntensity: 0.15,
  shadowThickness: 0.1,
  starGlintSize: 0.43,
  cameraDistance: 10.9,
};

const ProceduralEnvShader = {
  uniforms: {
    uTime: { value: 0 },
    uSkyColor: { value: new THREE.Color('#53B5F9') },
    uCloudColor: { value: new THREE.Color('#FFFFFF') },
    uHorizonColor: { value: new THREE.Color('#FFFFFF') },
    uCloudDensity: { value: 0.5 },
    uSunPos: { value: new THREE.Vector3(10, 20, 10).normalize() },
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
    uniform vec3 uCloudColor;
    uniform vec3 uHorizonColor;
    uniform float uCloudDensity;
    uniform vec3 uSunPos;
    varying vec3 vWorldDirection;

    #define PI 3.14159265359

    float hash(float n) {
      return fract(sin(n) * 43758.5453123);
    }

    float noise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      
      float n = dot(i, vec3(1.0, 57.0, 113.0));
      
      float a = hash(n + 0.0);
      float b = hash(n + 1.0);
      float c = hash(n + 57.0);
      float d = hash(n + 58.0);
      float e = hash(n + 113.0);
      float f1 = hash(n + 114.0);
      float g = hash(n + 170.0);
      float h = hash(n + 171.0);
      
      float res = mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
                      mix(mix(e, f1, f.x), mix(g, h, f.x), f.y), f.z);
      return res;
    }

    float fbm(vec3 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec3 dir = normalize(vWorldDirection);
      float h = dir.y * 0.5 + 0.5;
      vec3 sky = mix(uHorizonColor, uSkyColor, pow(h, 0.5));
      
      // Sun
      float sun = pow(max(0.0, dot(dir, uSunPos)), 200.0);
      float sunGlow = pow(max(0.0, dot(dir, uSunPos)), 8.0);
      sky += vec3(1.0, 0.9, 0.7) * sun * 2.0;
      sky += vec3(1.0, 0.8, 0.5) * sunGlow * 0.5;

      vec3 cloudPos = dir * 2.5;
      cloudPos.x += uTime * 0.02;
      cloudPos.z += uTime * 0.01;
      
      float f = fbm(cloudPos + fbm(cloudPos + uTime * 0.01));
      float cloudMask = smoothstep(1.0 - uCloudDensity, 1.1 - uCloudDensity, f);
      cloudMask *= smoothstep(0.0, 0.2, h) * smoothstep(1.0, 0.8, h);
      vec3 finalColor = mix(sky, uCloudColor, cloudMask * 0.8);
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
};

const DiscoBallShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#FFFFFF') },
    uFacetSize: { value: 40.0 },
    uSkyColor: { value: new THREE.Color('#53B5F9') },
    uCloudColor: { value: new THREE.Color('#FFFFFF') },
    uHorizonColor: { value: new THREE.Color('#FFFFFF') },
    uCloudDensity: { value: 0.5 },
    uSunPos: { value: new THREE.Vector3(10, 20, 10).normalize() },
    uGlintIntensity: { value: 1.0 },
    uGlintSize: { value: 0.98 },
    uSparkleIntensity: { value: 1.5 },
    uSparkleSize: { value: 0.95 },
    uSideSparkleIntensity: { value: 3.0 },
    uShadowShimmerIntensity: { value: 0.5 },
    uShadowThickness: { value: 0.1 },
    uStarGlintSize: { value: 0.15 },
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    varying vec3 vLocalPosition;
    varying mat4 vModelMatrix;

    void main() {
      vLocalPosition = position;
      vModelMatrix = modelMatrix;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uFacetSize;
    uniform vec3 uSkyColor;
    uniform vec3 uCloudColor;
    uniform vec3 uHorizonColor;
    uniform float uCloudDensity;
    uniform vec3 uSunPos;
    uniform float uGlintIntensity;
    uniform float uGlintSize;
    uniform float uSparkleIntensity;
    uniform float uSparkleSize;
    uniform float uSideSparkleIntensity;
    uniform float uShadowShimmerIntensity;
    uniform float uShadowThickness;
    uniform float uStarGlintSize;
    
    varying vec3 vWorldPosition;
    varying vec3 vLocalPosition;
    varying mat4 vModelMatrix;

    #define PI 3.14159265359

    float hash(float n) {
      return fract(sin(n) * 43758.5453123);
    }

    float noise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      
      float n = dot(i, vec3(1.0, 57.0, 113.0));
      
      float a = hash(n + 0.0);
      float b = hash(n + 1.0);
      float c = hash(n + 57.0);
      float d = hash(n + 58.0);
      float e = hash(n + 113.0);
      float f1 = hash(n + 114.0);
      float g = hash(n + 170.0);
      float h = hash(n + 171.0);
      
      float res = mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
                      mix(mix(e, f1, f.x), mix(g, h, f.x), f.y), f.z);
      return res;
    }

    float fbm(vec3 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
      }
      return v;
    }

    vec3 getProceduralColor(vec3 dir) {
      float h = dir.y * 0.5 + 0.5;
      vec3 sky = mix(uHorizonColor, uSkyColor, pow(h, 0.5));
      
      // Sun in reflection
      float sun = pow(max(0.0, dot(dir, uSunPos)), 200.0);
      float sunGlow = pow(max(0.0, dot(dir, uSunPos)), 8.0);
      sky += vec3(1.0, 0.9, 0.7) * sun * 2.0;
      sky += vec3(1.0, 0.8, 0.5) * sunGlow * 0.5;

      vec3 cloudPos = dir * 2.5;
      cloudPos.x += uTime * 0.02;
      cloudPos.z += uTime * 0.01;
      
      float f = fbm(cloudPos + fbm(cloudPos + uTime * 0.01));
      float cloudMask = smoothstep(1.0 - uCloudDensity, 1.1 - uCloudDensity, f);
      cloudMask *= smoothstep(0.0, 0.2, h) * smoothstep(1.0, 0.8, h);
      return mix(sky, uCloudColor, cloudMask * 0.8);
    }

    void main() {
      vec3 pos = normalize(vLocalPosition);
      float phi = acos(clamp(pos.y, -1.0, 1.0));
      float theta = atan(pos.z, pos.x);
      
      float qPhi = floor(phi * uFacetSize / PI) * PI / uFacetSize;
      float sinPhi = max(0.1, sin(qPhi + (0.5 * PI / uFacetSize)));
      float thetaFacets = max(1.0, floor(uFacetSize * 2.0 * sinPhi));
      float qTheta = floor((theta + PI) * thetaFacets / (2.0 * PI)) * (2.0 * PI) / thetaFacets - PI;
      
      float midPhi = qPhi + (0.5 * PI / uFacetSize);
      float midTheta = qTheta + (0.5 * (2.0 * PI) / thetaFacets);
      
      vec3 facetNormalLocal = normalize(vec3(
        sin(midPhi) * cos(midTheta),
        cos(midPhi),
        sin(midPhi) * sin(midTheta)
      ));

      vec3 worldFacetNormal = normalize(mat3(vModelMatrix) * facetNormalLocal);
      vec3 worldViewDir = normalize(vWorldPosition - cameraPosition);
      vec3 reflectDir = reflect(worldViewDir, worldFacetNormal);
      
      // Facet local coordinates for edge/corner detection
      float localY = (phi - qPhi) / (PI / uFacetSize); // 0 to 1
      float localX = (theta - qTheta) / ((2.0 * PI) / thetaFacets); // 0 to 1
      
      // Sparkles on upper edges and corners facing the sun
      float sunFacing = max(0.0, dot(worldFacetNormal, uSunPos));
      
      float upperEdge = smoothstep(0.1, 0.0, localY);
      float corner = upperEdge * (smoothstep(0.1, 0.0, localX) + smoothstep(0.9, 1.0, localX));
      
      float sparkleBase = (upperEdge * 0.5 + corner * 1.0) * sunFacing;
      float sparkle = pow(sparkleBase, 2.0) * uSparkleIntensity;

      vec3 sunDirLocal = normalize(mat3(inverse(vModelMatrix)) * uSunPos);
      vec3 fNormal = facetNormalLocal;
      vec3 fUp = vec3(0.0, 1.0, 0.0);
      vec3 fRight = normalize(cross(fUp, fNormal));
      if (length(fRight) < 0.1) fRight = vec3(1.0, 0.0, 0.0);
      
      float sunX = dot(sunDirLocal, fRight);
      float sideEdgeLeft = smoothstep(0.1, 0.0, localX);
      float sideEdgeRight = smoothstep(0.9, 1.0, localX);
      float sideWeight = smoothstep(-0.1, 0.1, sunX);
      float sideEdge = mix(sideEdgeLeft, sideEdgeRight, sideWeight);
      
      float sideSparkle = sideEdge * sunFacing * uSideSparkleIntensity;

      float shadowFacing = max(0.0, dot(worldFacetNormal, -uSunPos));
      float bottomEdge = smoothstep(1.0 - uShadowThickness, 1.0, localY);
      float sideShadowLeft = smoothstep(uShadowThickness, 0.0, localX);
      float sideShadowRight = smoothstep(1.0 - uShadowThickness, 1.0, localX);
      float sideShadow = mix(sideShadowLeft, sideShadowRight, sideWeight);
      
      float shadowEdge = max(sideShadow, bottomEdge);
      float shadowDarkening = shadowEdge * shadowFacing * uShadowShimmerIntensity;

      vec3 envColor = getProceduralColor(reflectDir);
      
      float glintFactor = dot(reflectDir, uSunPos);
      float glint = smoothstep(uGlintSize, 1.0, glintFactor);
      
      vec3 r = reflectDir;
      vec3 sunDir = uSunPos;
      vec3 up = vec3(0,1,0);
      vec3 right = normalize(cross(sunDir, up));
      vec3 localUp = cross(right, sunDir);
      float crossGlint = pow(abs(dot(r, right)), 100.0) + pow(abs(dot(r, localUp)), 100.0);
      glint += crossGlint * glint * 2.0;

      float edge = 1.0 - pow(dot(normalize(vLocalPosition), facetNormalLocal), 20.0);
      vec3 finalColor = (envColor * uColor) + (edge * 0.1) + (vec3(1.0, 0.95, 0.8) * glint * uGlintIntensity);
      
      finalColor += vec3(1.0, 1.0, 0.9) * (sparkle + sideSparkle);
      finalColor = max(vec3(0.0), finalColor - shadowDarkening);
      
      // NEW STAR FLARE LAYER
      // We want these to be larger and independent of the edge shimmers
      // They should appear at facet corners in the sun reflection area
      vec2 uvCorner = vec2(localX, localY);
      // Map to -1 to 1 within the facet, then find distance to nearest corner
      vec2 distToCorner = min(abs(uvCorner), abs(uvCorner - 1.0));
      float cornerDist = length(distToCorner);
      
      // Star shape: 4-pointed star
      // Use local coordinates relative to the nearest corner
      vec2 relUV = uvCorner;
      if (uvCorner.x > 0.5) relUV.x -= 1.0;
      if (uvCorner.y > 0.5) relUV.y -= 1.0;
      
      float starFlare = 0.0;
      float armWidth = uStarGlintSize * 0.1;
      // Horizontal arm
      starFlare += pow(max(0.0, 1.0 - abs(relUV.x) / uStarGlintSize), 2.0) * pow(max(0.0, 1.0 - abs(relUV.y) / armWidth), 4.0);
      // Vertical arm
      starFlare += pow(max(0.0, 1.0 - abs(relUV.y) / uStarGlintSize), 2.0) * pow(max(0.0, 1.0 - abs(relUV.x) / armWidth), 4.0);
      
      float starVisibility = smoothstep(uGlintSize - 0.05, 1.0, glintFactor);
      finalColor += vec3(1.0, 1.0, 0.9) * starFlare * starVisibility * uSparkleIntensity * 5.0;
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
};

function ProceduralBackground() {
  const skyColor = tweaks.skyColor;
  const cloudColor = tweaks.cloudColor;
  const horizonColor = tweaks.horizonColor;
  const cloudDensity = tweaks.cloudDensity;

  const sunPos = useMemo(() => new THREE.Vector3(10, 20, 10).normalize(), []);

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
      material.uniforms.uCloudColor.value.set(cloudColor);
      material.uniforms.uHorizonColor.value.set(horizonColor);
      material.uniforms.uCloudDensity.value = cloudDensity;
      material.uniforms.uSunPos.value.copy(sunPos);
    }
  });

  return (
    <mesh>
      <sphereGeometry args={[50, 32, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function DiscoBall() {
  const meshRef = useRef(null);
  const materialRef = useRef(null);
  
  const ballColor = tweaks.ballColor;
  const rotationSpeed = tweaks.rotationSpeed;
  const facetSize = tweaks.facetSize;
  const stringColor = tweaks.stringColor;
  const stringVisible = tweaks.stringVisible;
  const stringThickness = tweaks.stringThickness;
  
  const skyColor = tweaks.skyColor;
  const cloudColor = tweaks.cloudColor;
  const horizonColor = tweaks.horizonColor;
  const cloudDensity = tweaks.cloudDensity;
  const glintIntensity = tweaks.glintIntensity;
  const glintSize = tweaks.glintSize;
  const sparkleIntensity = tweaks.sparkleIntensity;
  const sparkleSize = tweaks.sparkleSize;
  const sideSparkleIntensity = tweaks.sideSparkleIntensity;
  const shadowShimmerIntensity = tweaks.shadowShimmerIntensity;
  const shadowThickness = tweaks.shadowThickness;
  const starGlintSize = tweaks.starGlintSize;

  const sunPos = useMemo(() => new THREE.Vector3(10, 20, 10).normalize(), []);

  const uniforms = useMemo(() => {
    return THREE.UniformsUtils.clone(DiscoBallShader.uniforms);
  }, []);

  const stringGeometry = useMemo(() => new THREE.CylinderGeometry(stringThickness, stringThickness, 100, 8), [stringThickness]);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * rotationSpeed;
    }
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.uColor.value.set(ballColor);
      materialRef.current.uniforms.uFacetSize.value = facetSize;
      materialRef.current.uniforms.uSkyColor.value.set(skyColor);
      materialRef.current.uniforms.uCloudColor.value.set(cloudColor);
      materialRef.current.uniforms.uHorizonColor.value.set(horizonColor);
      materialRef.current.uniforms.uCloudDensity.value = cloudDensity;
      materialRef.current.uniforms.uSunPos.value.copy(sunPos);
      materialRef.current.uniforms.uGlintIntensity.value = glintIntensity;
      materialRef.current.uniforms.uGlintSize.value = glintSize;
      materialRef.current.uniforms.uSparkleIntensity.value = sparkleIntensity;
      materialRef.current.uniforms.uSparkleSize.value = sparkleSize;
      materialRef.current.uniforms.uSideSparkleIntensity.value = sideSparkleIntensity;
      materialRef.current.uniforms.uShadowShimmerIntensity.value = shadowShimmerIntensity;
      materialRef.current.uniforms.uShadowThickness.value = shadowThickness;
      materialRef.current.uniforms.uStarGlintSize.value = starGlintSize;
    }
  });

  return (
    <group ref={meshRef}>
      {stringVisible && (
        <mesh position={[0, 50, 0]} geometry={stringGeometry}>
          <meshBasicMaterial color={stringColor} />
        </mesh>
      )}
      <mesh>
        <sphereGeometry args={[2, 64, 64]} />
        <shaderMaterial
          ref={materialRef}
          fragmentShader={DiscoBallShader.fragmentShader}
          vertexShader={DiscoBallShader.vertexShader}
          uniforms={uniforms}
        />
      </mesh>
    </group>
  );
}

export default function Component() {
  const cameraDistance = tweaks.cameraDistance;

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#000' }}>
      <Canvas dpr={window.devicePixelRatio} gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <PerspectiveCamera makeDefault position={[0, 0, cameraDistance]} />
        <OrbitControls enablePan={false} minDistance={4} maxDistance={20} />
        <Suspense fallback={null}>
          <ProceduralBackground />
          <DiscoBall />
        </Suspense>
      </Canvas>
    </div>
  );
}