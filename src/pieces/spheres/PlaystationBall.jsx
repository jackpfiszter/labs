import React, { useRef, useMemo, Suspense, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
// Optimized CRT Shader: Combined effects into a single pass with minimal branching
const CRT_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CRT_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform vec3 uMagnetPos;
  uniform vec3 uMagnetPos2;
  uniform vec3 uMagnetPos3;
  uniform float uMagnetStrength;
  uniform float uMagnetSize;
  uniform float uScanline;
  uniform float uChroma;
  uniform float uStatic;
  uniform float uBloom;

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  // Tri-planar mapping helper to avoid pole pinching
  vec4 triplanarSample(sampler2D tex, vec3 p, vec3 n) {
    vec3 blending = abs(n);
    blending /= (blending.x + blending.y + blending.z);
    
    // Scale for texture tiling
    float scale = 0.25;
    vec4 x = texture2D(tex, p.yz * scale);
    vec4 y = texture2D(tex, p.xz * scale);
    vec4 z = texture2D(tex, p.xy * scale);
    
    return x * blending.x + y * blending.y + z * blending.z;
  }

  void main() {
    vec3 dir = normalize(vPosition);
    vec3 norm = normalize(vNormal);
    
    // 1. 3D Magnetic Deflection (Three Poles)
    float dist1 = distance(vPosition, uMagnetPos);
    float force1 = uMagnetStrength * exp(-dist1 * dist1 / (uMagnetSize * uMagnetSize));
    
    float dist2 = distance(vPosition, uMagnetPos2);
    float force2 = -uMagnetStrength * exp(-dist2 * dist2 / (uMagnetSize * uMagnetSize));

    float dist3 = distance(vPosition, uMagnetPos3);
    float force3 = uMagnetStrength * 0.7 * exp(-dist3 * dist3 / (uMagnetSize * uMagnetSize));
    
    float totalForce = force1 + force2 + force3;
    
    vec3 toMagnet1 = normalize(uMagnetPos - vPosition);
    vec3 toMagnet2 = normalize(uMagnetPos2 - vPosition);
    vec3 toMagnet3 = normalize(uMagnetPos3 - vPosition);
    
    vec3 swirlDir1 = cross(norm, toMagnet1);
    vec3 swirlDir2 = cross(norm, toMagnet2);
    vec3 swirlDir3 = cross(norm, toMagnet3);
    
    // Distort the lookup position for tri-planar mapping
    vec3 distortedPos = vPosition + (swirlDir1 * force1 + swirlDir2 * force2 + swirlDir3 * force3) * 0.5;

    // 2. Chromatic Aberration with Tri-planar
    float absForce = abs(totalForce);
    float chromaOffset = uChroma * absForce + 0.003;
    
    vec4 rSample = triplanarSample(uTexture, distortedPos + vec3(chromaOffset, 0.0, 0.0), norm);
    vec4 gSample = triplanarSample(uTexture, distortedPos, norm);
    vec4 bSample = triplanarSample(uTexture, distortedPos - vec3(chromaOffset, 0.0, 0.0), norm);
    
    vec3 color = vec3(rSample.r, gSample.g, bSample.b);

    // 3. TV Static
    float staticNoise = random(vUv + uTime * 10.0);
    color += (staticNoise - 0.5) * uStatic;

    // 4. Magnetic Color Distortion
    vec3 magColor1 = vec3(
        sin(force1 * 12.0 + uTime * 2.0),
        sin(force1 * 12.0 + uTime * 2.0 + 2.0),
        sin(force1 * 12.0 + uTime * 2.0 + 4.0)
    ) * 0.5 + 0.5;
    
    vec3 magColor2 = vec3(
        sin(force2 * 12.0 + uTime * 2.0 + 3.14),
        sin(force2 * 12.0 + uTime * 2.0 + 5.14),
        sin(force2 * 12.0 + uTime * 2.0 + 7.14)
    ) * 0.5 + 0.5;

    vec3 magColor3 = vec3(
        sin(force3 * 15.0 + uTime * 3.0),
        sin(force3 * 15.0 + uTime * 3.0 + 1.0),
        sin(force3 * 15.0 + uTime * 3.0 + 2.0)
    ) * 0.5 + 0.5;
    
    color = mix(color, color * magColor1 * 3.0, abs(force1) * 0.8);
    color = mix(color, color * magColor2 * 3.0, abs(force2) * 0.8);
    color = mix(color, color * magColor3 * 3.0, abs(force3) * 0.8);

    // 5. Scanlines with Interlacing Vibration
    float scanlinePos = vUv.y * 800.0;
    // Interlacing jitter: shift scanlines up/down slightly every other frame or at high frequency
    float interlaceJitter = sin(uTime * 60.0) * 0.5; 
    color -= sin(scanlinePos + uTime * 5.0 + interlaceJitter) * 0.1 * uScanline;

    // 6. Fresnel / Glow
    float fresnel = pow(1.0 - max(dot(norm, vec3(0,0,1)), 0.0), 3.0);
    color += vec3(0.2, 0.1, 0.4) * fresnel * 0.4;

    // 7. Screen Flicker
    color *= 0.98 + 0.02 * sin(60.0 * uTime);

    // 8. Radial Bloom Mask (Strongest at edges)
    // dot(norm, vec3(0,0,1)) is roughly the view-space Z of the normal
    // 1.0 - abs(norm.z) gives us a value that is 1.0 at the silhouette and 0.0 at the center
    float radialMask = pow(1.0 - abs(norm.z), 2.0);
    vec3 bloom = color * radialMask * uBloom;
    color += bloom;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const CRTSphere = ({ magnetPos, magnetPos2, magnetPos3, magnetStrength, magnetSize, scanlineIntensity, chromaticAberration, animationSpeed, staticIntensity, shapeDensity, bloomIntensity }) => {
  const meshRef = useRef(null);
  const materialRef = useRef(null);
  const canvasRef = useRef(null);
  const textureRef = useRef(null);
  
  // Use a smaller texture for better performance on mobile
  const texture = useMemo(() => {
    const size = 512; 
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvasRef.current = canvas;
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    textureRef.current = tex;
    return tex;
  }, []);

  useFrame((state) => {
    const time = state.clock.elapsedTime * animationSpeed;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d', { alpha: false });
      if (ctx) {
        const size = canvas.width;
        
        // Background
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, size, size);

        // Radial Gradient
        const hueBase = (time * 20) % 360;
        const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size);
        grad.addColorStop(0, `hsl(${hueBase}, 70%, 15%)`);
        grad.addColorStop(1, '#000');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        // Batch drawing shapes with wrapping logic
        const count = Math.floor(shapeDensity);
        const drawShape = (x, y, i, s, isSolid, hue) => {
          ctx.save();
          ctx.translate(x, y);
          // Rotate based on time and individual shape index for variety
          ctx.rotate(time * 1.5 + i * 0.5);
          ctx.beginPath();
          const shapeType = i % 5;
          if (shapeType === 0) {
            ctx.rect(-s/2, -s/2, s, s);
          } else if (shapeType === 1) {
            ctx.arc(0, 0, s/2, 0, Math.PI * 2);
          } else if (shapeType === 2) {
            ctx.moveTo(0, -s/2);
            ctx.lineTo(s/2, s/2);
            ctx.lineTo(-s/2, s/2);
            ctx.closePath();
          } else if (shapeType === 3) {
            // X shape
            const half = s / 2;
            ctx.moveTo(-half, -half);
            ctx.lineTo(half, half);
            ctx.moveTo(half, -half);
            ctx.lineTo(-half, half);
          } else {
            // Square (explicitly added back)
            ctx.rect(-s/2, -s/2, s, s);
          }
          if (isSolid) {
            ctx.fillStyle = `hsla(${hue}, 85%, 65%, 0.8)`;
            ctx.fill();
          } else {
            ctx.strokeStyle = `hsl(${hue}, 85%, 65%)`;
            ctx.lineWidth = 4;
            ctx.stroke();
          }
          ctx.restore();
        };

        for (let i = 0; i < count; i++) {
          // Use modulo to keep positions within [0, size]
          let x = (size * 0.5 + Math.cos(time * 0.4 + i * 1.3) * size * 0.8) % size;
          let y = (size * 0.5 + Math.sin(time * 0.6 + i * 1.7) * size * 0.8) % size;
          if (x < 0) x += size;
          if (y < 0) y += size;

          const isSolid = i % 2 === 0;
          const s = isSolid ? (80 + Math.sin(time * 1.2 + i) * 40) : (40 + Math.sin(time * 1.2 + i) * 20);
          const hue = (time * 30 + i * (360 / count)) % 360;

          // Draw main shape
          drawShape(x, y, i, s, isSolid, hue);

          // Draw wraps for seamless tiling
          const margin = s;
          if (x < margin) drawShape(x + size, y, i, s, isSolid, hue);
          if (x > size - margin) drawShape(x - size, y, i, s, isSolid, hue);
          if (y < margin) drawShape(x, y + size, i, s, isSolid, hue);
          if (y > size - margin) drawShape(x, y - size, i, s, isSolid, hue);
          
          // Corner wraps
          if (x < margin && y < margin) drawShape(x + size, y + size, i, s, isSolid, hue);
          if (x > size - margin && y < margin) drawShape(x - size, y + size, i, s, isSolid, hue);
          if (x < margin && y > size - margin) drawShape(x + size, y - size, i, s, isSolid, hue);
          if (x > size - margin && y > size - margin) drawShape(x - size, y - size, i, s, isSolid, hue);
        }

        // Grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= size; i += 64) {
          ctx.moveTo(i, 0); ctx.lineTo(i, size);
          ctx.moveTo(0, i); ctx.lineTo(size, i);
        }
        ctx.stroke();
      }
      if (textureRef.current) textureRef.current.needsUpdate = true;
    }

    if (materialRef.current) {
      const uniforms = materialRef.current.uniforms;
      uniforms.uTime.value = state.clock.elapsedTime;
      uniforms.uMagnetPos.value.copy(magnetPos);
      uniforms.uMagnetPos2.value.copy(magnetPos2);
      uniforms.uMagnetPos3.value.copy(magnetPos3);
      uniforms.uMagnetStrength.value = magnetStrength;
      uniforms.uMagnetSize.value = magnetSize;
      uniforms.uScanline.value = scanlineIntensity;
      uniforms.uChroma.value = chromaticAberration;
      uniforms.uStatic.value = staticIntensity;
      uniforms.uBloom.value = bloomIntensity;
    }
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.001 * animationSpeed;
    }
  });

  const uniforms = useMemo(() => ({
    uTexture: { value: texture },
    uTime: { value: 0 },
    uMagnetPos: { value: new THREE.Vector3(0, 0, 0) },
    uMagnetPos2: { value: new THREE.Vector3(0, 0, 0) },
    uMagnetPos3: { value: new THREE.Vector3(0, 0, 0) },
    uMagnetStrength: { value: magnetStrength },
    uMagnetSize: { value: magnetSize },
    uScanline: { value: scanlineIntensity },
    uChroma: { value: chromaticAberration },
    uStatic: { value: staticIntensity },
    uBloom: { value: bloomIntensity }
  }), [texture]);

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[2.2, 64, 64]} /> {/* Reduced geometry detail for performance */}
      <shaderMaterial
        ref={materialRef}
        vertexShader={CRT_VERTEX_SHADER}
        fragmentShader={CRT_FRAGMENT_SHADER}
        uniforms={uniforms}
      />
    </mesh>
  );
};

const BackgroundGradient = ({ animationSpeed }) => {
  const meshRef = useRef(null);
  const materialRef = useRef(null);

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    precision highp float;
    varying vec2 vUv;
    uniform float uTime;
    
    void main() {
      vec2 center = vec2(0.5, 0.5);
      float dist = distance(vUv, center);
      
      // Dynamic colors based on time to match the sphere's shifting palette
      vec3 color1 = 0.5 + 0.5 * cos(uTime * 0.5 + vec3(0.0, 2.0, 4.0));
      vec3 color2 = 0.5 + 0.5 * cos(uTime * 0.3 + vec3(1.0, 3.0, 5.0));
      
      // Darken the colors for a background feel
      color1 *= 0.15;
      color2 *= 0.05;
      
      vec3 finalColor = mix(color1, color2, smoothstep(0.1, 0.8, dist));
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  const uniforms = useMemo(() => ({
    uTime: { value: 0 }
  }), []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime * animationSpeed;
    }
  });

  return (
    <mesh ref={meshRef} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
};

const Water = ({ waterLevel, animationSpeed, spherePos }) => {
  const meshRef = useRef(null);
  const materialRef = useRef(null);

  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    void main() {
      vUv = uv;
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const fragmentShader = `
    precision highp float;
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    uniform float uTime;
    uniform vec3 uSpherePos;
    
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    void main() {
      // Shimmering waves
      float wave1 = sin(vWorldPosition.x * 0.5 + uTime * 1.2) * 0.5 + 0.5;
      float wave2 = cos(vWorldPosition.z * 0.4 - uTime * 0.8) * 0.5 + 0.5;
      float shimmer = pow(wave1 * wave2, 3.0) * 0.2;
      
      // Dark water base
      vec3 waterColor = vec3(0.02, 0.03, 0.08);
      
      // Reflection/Glow from sphere
      float distToSphere = distance(vWorldPosition.xz, uSpherePos.xz);
      float glow = exp(-distToSphere * 0.4) * 0.6;
      
      // Dynamic reflection color
      vec3 reflectColor = 0.5 + 0.5 * cos(uTime * 0.5 + vec3(0.0, 2.0, 4.0));
      reflectColor *= glow;
      
      vec3 finalColor = waterColor + reflectColor + vec3(shimmer);
      
      // Edge fade
      float edgeFade = 1.0 - smoothstep(15.0, 25.0, length(vWorldPosition.xz));
      
      gl_FragColor = vec4(finalColor, edgeFade);
    }
  `;

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSpherePos: { value: new THREE.Vector3(0, 0, 0) }
  }), []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime * animationSpeed;
      materialRef.current.uniforms.uSpherePos.value.set(0, 0, 0); // Sphere is at origin
    }
  });

  return (
    <mesh ref={meshRef} position={[0, waterLevel, 0]} rotation={[-Math.PI / 2, 0, 0]} transparent>
      <planeGeometry args={[60, 60]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
      />
    </mesh>
  );
};

const Scene = ({ magnetStrength, magnetSize, scanlineIntensity, chromaticAberration, animationSpeed, staticIntensity, shapeDensity, cameraDistance, waterLevel, bloomIntensity }) => {
  const magnetPos = useRef(new THREE.Vector3(3, 0, 0));
  const magnetPos2 = useRef(new THREE.Vector3(-3, 0, 0));
  const magnetPos3 = useRef(new THREE.Vector3(0, 3, 0));
  const { gl } = useThree();

  // Performance optimization: handle context loss
  useEffect(() => {
    const handleContextLost = (event) => {
      event.preventDefault();
      console.warn('WebGL Context Lost');
    };

    gl.domElement.addEventListener('webglcontextlost', handleContextLost, false);

    return () => {
      gl.domElement.removeEventListener('webglcontextlost', handleContextLost);
    };
  }, [gl]);
  
  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.8 * animationSpeed;
    
    // Pole 1 movement
    const radius1 = 2.5 + Math.sin(t * 0.5) * 0.5;
    magnetPos.current.set(
      radius1 * Math.cos(t) * Math.sin(t * 0.7),
      radius1 * Math.sin(t * 1.2),
      radius1 * Math.cos(t) * Math.cos(t * 0.7)
    );

    // Pole 2 movement (offset and different phase)
    const t2 = t + Math.PI;
    const radius2 = 2.5 + Math.cos(t * 0.4) * 0.5;
    magnetPos2.current.set(
      radius2 * Math.cos(t2 * 0.9) * Math.cos(t2 * 0.5),
      radius2 * Math.sin(t2 * 1.1),
      radius2 * Math.sin(t2 * 0.9) * Math.cos(t2 * 0.5)
    );

    // Pole 3 movement (chaotic)
    const t3 = t * 1.5 + 2.0;
    const radius3 = 3.0 + Math.sin(t * 0.8) * 1.0;
    magnetPos3.current.set(
      radius3 * Math.sin(t3 * 0.5) * Math.cos(t3 * 1.2),
      radius3 * Math.cos(t3 * 0.7),
      radius3 * Math.sin(t3 * 0.5) * Math.sin(t3 * 1.2)
    );
  });

  return (
    <>
      <BackgroundGradient animationSpeed={animationSpeed} />
      <PerspectiveCamera makeDefault position={[0, 0, cameraDistance]} fov={40} />
      <OrbitControls 
        enablePan={false} 
        enableZoom={false}
        autoRotate
        autoRotateSpeed={0.5}
        makeDefault
      />
      
      <Suspense fallback={null}>
        <CRTSphere 
          magnetPos={magnetPos.current}
          magnetPos2={magnetPos2.current}
          magnetPos3={magnetPos3.current}
          magnetStrength={magnetStrength}
          magnetSize={magnetSize}
          scanlineIntensity={scanlineIntensity}
          chromaticAberration={chromaticAberration}
          animationSpeed={animationSpeed}
          staticIntensity={staticIntensity}
          shapeDensity={shapeDensity}
          bloomIntensity={bloomIntensity}
        />
        <Water waterLevel={waterLevel} animationSpeed={animationSpeed} spherePos={new THREE.Vector3(0,0,0)} />
      </Suspense>
    </>
  );
};

export default function Component() {
  const magnetStrength = 0.5;
  const magnetSize = 2.0;
  const scanlineIntensity = 0.4;
  const chromaticAberration = 0.09;
  const staticIntensity = 0.2;
  const shapeDensity = 64.0;
  const animationSpeed = 0.2;
  const cameraDistance = 11.5;
  const waterLevel = -5.0;
  const bloomIntensity = 0.6;

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', touchAction: 'none', userSelect: 'none', background: '#000' }}>
      <Canvas
        style={{ width: '100%', height: '100%' }}
        shadows={false}
        dpr={[1, 1.5]} // Capped DPR for performance
        gl={{ 
          antialias: true, 
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
          depth: true
        }}
      >
        <Scene 
          magnetStrength={magnetStrength}
          magnetSize={magnetSize}
          scanlineIntensity={scanlineIntensity}
          chromaticAberration={chromaticAberration}
          animationSpeed={animationSpeed}
          staticIntensity={staticIntensity}
          shapeDensity={shapeDensity}
          cameraDistance={cameraDistance}
          waterLevel={waterLevel}
          bloomIntensity={bloomIntensity}
        />
      </Canvas>
    </div>
  );
}