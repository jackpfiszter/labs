import React, { useRef, useEffect, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Float, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { gizmoRuntime } from '@gizmo/runtime';

const tweaks = gizmoRuntime.tweaks({
  skyColor: { index: 0, name: 'Sky Color', type: 'color', value: "#000000" },
  groundColor: { index: 1, name: 'Ground Color', type: 'color', value: "#000000" },
  inputPlaceholder: { index: 2, name: 'Placeholder', type: 'text', value: "type a name...", group: 'input' },
  inputColor: { index: 3, name: 'Input Text Color', type: 'color', value: '#000000', group: 'input' },
  inputSize: { index: 4, name: 'Input Font Size', type: 'slider', value: 18, min: 12, max: 32, step: 1, group: 'input' },
  inputVisible: { index: 5, name: 'Show Input', type: 'toggle', value: true, group: 'input' },
  hintText: { index: 6, name: 'Hint Text', type: 'text', value: 'Press Enter to plant!', group: 'hint' },
  hintColor: { index: 7, name: 'Hint Color', type: 'color', value: '#FFFFFF', group: 'hint' },
  hintSize: { index: 8, name: 'Hint Size', type: 'slider', value: 14, min: 8, max: 24, step: 1, group: 'hint' },
  hintVisible: { index: 9, name: 'Show Hint', type: 'toggle', value: true, group: 'hint' },
  gardenSpread: { index: 10, name: 'Garden Spread', type: 'slider', value: 5, min: 1, max: 15, step: 0.5 },
  footerText: { index: 11, name: 'Footer Text', type: 'text', value: 'Every name grows a unique flower', group: 'footer' },
  footerColor: { index: 12, name: 'Footer Color', type: 'color', value: '#FFFFFF', group: 'footer' },
  footerSize: { index: 13, name: 'Footer Size', type: 'slider', value: 12, min: 8, max: 24, step: 1, group: 'footer' },
  footerVisible: { index: 14, name: 'Show Footer', type: 'toggle', value: true, group: 'footer' },
  hideUIButton: { index: 15, name: 'Hide UI Button', type: 'text', value: "hide ui", group: 'hide-ui' },
  hideUIButtonColor: { index: 16, name: 'Hide UI Button Color', type: 'color', value: '#FFFFFF', group: 'hide-ui' },
  hideUIButtonSize: { index: 17, name: 'Hide UI Button Size', type: 'slider', value: 12, min: 8, max: 24, step: 1, group: 'hide-ui' },
  hideUIButtonVisible: { index: 18, name: 'Show Hide UI Button', type: 'toggle', value: true, group: 'hide-ui' },
  stemTopColor: { index: 19, name: 'Stem Top Color', type: 'color', value: "#75F94C" },
  flowerSize: { index: 20, name: 'Flower Size', type: 'slider', value: 0.5, min: 0.2, max: 3.0, step: 0.1 },
  particleCount: { index: 21, name: 'Particle Count', type: 'slider', value: 300.0, min: 20, max: 300, step: 10, group: 'particles' },
  particleSize: { index: 22, name: 'Particle Size', type: 'slider', value: 0.5, min: 0.05, max: 0.5, step: 0.01, group: 'particles' },
  particleSpeed: { index: 23, name: 'Particle Speed', type: 'slider', value: 0.5, min: 0.1, max: 2.0, step: 0.1, group: 'particles' },
  titleText: { index: 24, name: 'Title Text', type: 'text', value: "if your friends were flowers what would they look like?", group: 'title' },
  titleColor: { index: 25, name: 'Title Color', type: 'color', value: "#75F2B0", group: 'title' },
  titleSize: { index: 26, name: 'Title Size', type: 'slider', value: 25.94358, min: 16, max: 64, step: 1, group: 'title' },
  titleVisible: { index: 27, name: 'Show Title', type: 'toggle', value: true, group: 'title' },
  tutorialText: { index: 28, name: 'Tutorial Text', type: 'text', value: "", group: 'tutorial' },
  tutorialColor: { index: 29, name: 'Tutorial Color', type: 'color', value: '#FFFFFF', group: 'tutorial' },
  tutorialSize: { index: 30, name: 'Tutorial Size', type: 'slider', value: 16, min: 10, max: 32, step: 1, group: 'tutorial' },
  tutorialVisible: { index: 31, name: 'Show Tutorial', type: 'toggle', value: true, group: 'tutorial' },
});

const hashName = (name: string) => {
  let hash = 0;
  const str = name.toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const Leaf = ({ position, growth, side, rotationZ, stemTopColor, groundColor, hFactor }: any) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const leafColor = useMemo(() => {
    const top = new THREE.Color(stemTopColor);
    const bottom = new THREE.Color(groundColor);
    const alpha = Math.min(1, Math.max(0, hFactor / 0.5));
    const mixFactor = Math.pow(alpha, 0.8);
    return bottom.clone().lerp(top, mixFactor);
  }, [stemTopColor, groundColor, hFactor]);

  const leafShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.08 * side, 0.1, 0.12 * side, 0.25, 0.12 * side, 0.4);
    shape.bezierCurveTo(0.12 * side, 0.55, 0.08 * side, 0.7, 0, 0.8);
    shape.bezierCurveTo(-0.08 * side, 0.7, -0.12 * side, 0.55, -0.12 * side, 0.4);
    shape.bezierCurveTo(-0.12 * side, 0.25, -0.08 * side, 0.1, 0, 0);
    return shape;
  }, [side]);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
      meshRef.current.rotateX(-Math.PI / 6);
      meshRef.current.rotateZ(rotationZ);
    }
  });

  return (
    <mesh ref={meshRef} position={position} scale={[0.8 * growth, 0.8 * growth, 0.8 * growth]}>
      <shapeGeometry args={[leafShape]} />
      <meshBasicMaterial color={leafColor} side={THREE.DoubleSide} transparent={false} toneMapped={false} depthTest={true} depthWrite={true} />
    </mesh>
  );
};

const StemAndLeaves = ({ stemHeight, growth, leaves, stemTopColor, groundColor }: any) => {
  const geometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.03, 0.05, stemHeight, 8, 10);
    geo.translate(0, stemHeight / 2, 0);
    const count = geo.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const top = new THREE.Color(stemTopColor);
    const bottom = new THREE.Color(groundColor);
    for (let i = 0; i < count; i++) {
      const y = geo.attributes.position.getY(i);
      const alpha = Math.min(1, Math.max(0, (y / stemHeight) / 0.5));
      const mixed = bottom.clone().lerp(top, alpha);
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [stemHeight, stemTopColor, groundColor]);

  return (
    <group scale={[1, growth, 1]}>
      <mesh geometry={geometry}>
        <meshBasicMaterial vertexColors toneMapped={false} depthTest={true} depthWrite={true} />
      </mesh>
      {leaves.map((leaf: any, i: number) => (
        <Leaf 
          key={`leaf-${i}`} 
          position={leaf.position} 
          growth={1}
          side={leaf.side}
          rotationZ={leaf.rotationZ}
          stemTopColor={stemTopColor}
          groundColor={groundColor}
          hFactor={leaf.hFactor}
        />
      ))}
    </group>
  );
};

const FlowerHead = ({ growth, centerColor, petalCount, color, secondaryColor, seed, petalWidth, petalLength, petalCurvature, flowerSize, baseRenderOrder }: any) => {
  const groupRef = useRef<THREE.Group>(null);

  const petalMaterial = useMemo(() => {
    const c1 = new THREE.Color(color);
    const c2 = new THREE.Color(secondaryColor);
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor1: { value: c1 },
        uColor2: { value: c2 },
        uTime: { value: 0 },
        uSeed: { value: seed % 100 },
        uGrowth: { value: 0 },
        uShapeType: { value: seed % 4 }
      },
      vertexShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uSeed;
        uniform float uGrowth;
        void main() {
          vUv = uv;
          vec3 pos = position;
          float sway = sin(uTime * 2.0 + uSeed + pos.y * 2.0) * 0.05 * uGrowth;
          pos.x += sway;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform float uGrowth;
        uniform float uShapeType;
        void main() {
          // Gradient based on UV
          vec3 color = mix(uColor1, uColor2, vUv.y);
          
          // Shape variation logic in shader
          float d = distance(vUv, vec2(0.5, 0.0));
          float mask = 1.0;
          
          // Use step for sharp edges instead of smoothstep
          if (uShapeType < 1.0) {
            // Pointy
            mask = step(0.01, vUv.y) * (1.0 - step(0.95, vUv.y + abs(vUv.x - 0.5) * 0.5));
          } else if (uShapeType < 2.0) {
            // Heart-ish / Notched
            float notch = abs(vUv.x - 0.5) * 0.4;
            mask = step(0.01, vUv.y) * (1.0 - step(0.95 - notch, vUv.y));
          } else if (uShapeType < 3.0) {
            // Rounded
            float dist = distance(vUv, vec2(0.5, 0.3));
            mask = step(0.01, vUv.y) * (1.0 - step(0.6, dist));
          } else {
            // Frilly
            float frill = sin(vUv.x * 30.0) * 0.04;
            mask = step(0.01, vUv.y) * (1.0 - step(0.88 + frill, vUv.y));
          }

          if (mask < 0.5) discard;
          gl_FragColor = vec4(color, uGrowth);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
    });
  }, [color, secondaryColor, seed]);

  const centerMaterial = useMemo(() => {
    const c = new THREE.Color(centerColor);
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: c },
        uTime: { value: 0 },
        uGrowth: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 uColor;
        uniform float uTime;
        uniform float uGrowth;
        void main() {
          float dist = distance(vUv, vec2(0.5));
          float pulse = sin(uTime * 3.0) * 0.1 + 0.9;
          float mask = smoothstep(0.5, 0.48, dist);
          vec3 finalColor = uColor * (1.0 + (1.0 - dist * 2.0) * 0.5 * pulse);
          gl_FragColor = vec4(finalColor, mask * uGrowth);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
  }, [centerColor]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.quaternion.copy(state.camera.quaternion);
    }
    if (petalMaterial) {
      petalMaterial.uniforms.uTime.value = state.clock.elapsedTime;
      petalMaterial.uniforms.uGrowth.value = growth;
    }
    if (centerMaterial) {
      centerMaterial.uniforms.uTime.value = state.clock.elapsedTime;
      centerMaterial.uniforms.uGrowth.value = growth;
    }
  });

  const petalShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.4, 0.2, 0.5, 0.8, 0.5, 1.2);
    shape.bezierCurveTo(0.5, 1.6, 0.2, 1.8, 0, 1.8);
    shape.bezierCurveTo(-0.2, 1.8, -0.5, 1.6, -0.5, 1.2);
    shape.bezierCurveTo(-0.5, 0.8, -0.4, 0.2, 0, 0);
    return shape;
  }, []);

  const finalScale = growth * flowerSize;

  return (
    <group ref={groupRef} scale={[finalScale, finalScale, finalScale]}>
      {/* Petals - Slot 1 */}
      <group>
        {Array.from({ length: petalCount }).map((_, i) => {
          const angle = (i / petalCount) * Math.PI * 2;
          return (
            <mesh 
              key={i} 
              rotation={[petalCurvature, 0, angle + Math.PI / 2]}
              scale={[petalWidth, petalLength, 1]}
              renderOrder={baseRenderOrder + 1}
            >
              <shapeGeometry args={[petalShape, 32]} />
              <primitive object={petalMaterial} attach="material" />
            </mesh>
          );
        })}
      </group>

      {/* Center - Slot 2 */}
      <mesh renderOrder={baseRenderOrder + 2} position={[0, 0, 0.01]}>
        <circleGeometry args={[0.3, 32]} />
        <primitive object={centerMaterial} attach="material" />
      </mesh>
    </group>
  );
};

const Flower = ({ name, position, stemTopColor, groundColor, flowerSize }: { name: string, position: [number, number, number], stemTopColor: string, groundColor: string, flowerSize: number }) => {
  const { camera } = useThree();
  const seed = useMemo(() => hashName(name), [name]);
  const [growth, setGrowth] = useState(0);
  const [flowerRenderOrder, setFlowerRenderOrder] = useState(0);
  
  const stemHeight = useMemo(() => 2.2 + ((seed % 20) / 10.0), [seed]);
  
  useFrame(() => {
    const dist = camera.position.distanceTo(new THREE.Vector3(...position));
    const baseOrder = Math.floor((100 - dist) * 10);
    setFlowerRenderOrder(baseOrder * 10);
  });

  const petalCount = useMemo(() => 4 + (seed % 8), [seed]);
  
  // Harmonious Color Generation
  const { color, secondaryColor, centerColor } = useMemo(() => {
    const hue = (seed % 360);
    const saturation = 65 + (seed % 25);
    const lightness = 55 + (seed % 15);
    
    // Color schemes: Analogous, Complementary, or Triadic
    const schemeType = seed % 3;
    let secondaryHue = hue;
    let centerHue = hue;

    if (schemeType === 0) { // Analogous
      secondaryHue = (hue + 30) % 360;
      centerHue = (hue - 30 + 360) % 360;
    } else if (schemeType === 1) { // Complementary
      secondaryHue = (hue + 180) % 360;
      centerHue = (hue + 15) % 360;
    } else { // Triadic
      secondaryHue = (hue + 120) % 360;
      centerHue = (hue + 240) % 360;
    }

    const c1 = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    const c2 = `hsl(${secondaryHue}, ${saturation - 10}%, ${lightness + 10}%)`;
    
    const centerColors = ['#FFFFFF', '#FFDD46', '#E93323', '#8762F6', '#2227F5', '#000000', '#53B5F9'];
    const c3 = centerColors[seed % centerColors.length];
    // Or use the calculated centerHue for even more harmony
    const c3Harmonious = `hsl(${centerHue}, ${saturation + 10}%, ${lightness - 10}%)`;
    
    return { 
      color: c1, 
      secondaryColor: c2, 
      centerColor: (seed % 2 === 0) ? c3 : c3Harmonious 
    };
  }, [seed]);

  const leaves = useMemo(() => {
    const leafCount = 1 + (seed % 2);
    const result = [];
    const minH = 0.35;
    const maxH = 0.75;
    const range = maxH - minH;
    const minGap = 0.15;
    const sideLeaves: { [key: number]: number[] } = { 1: [], [-1]: [] };
    for (let i = 0; i < leafCount; i++) {
      let hFactor = 0;
      let side = 0;
      let attempts = 0;
      let valid = false;
      while (!valid && attempts < 20) {
        const hRandom = ((seed * (i + 13 + attempts)) % 100) / 100;
        hFactor = minH + (range * hRandom);
        const sideSeed = (seed >> (i + 2 + attempts)) + i;
        side = sideSeed % 2 === 0 ? 1 : -1;
        const tooClose = sideLeaves[side].some(existingH => Math.abs(existingH - hFactor) < minGap);
        if (!tooClose) valid = true;
        attempts++;
      }
      sideLeaves[side].push(hFactor);
      const h = hFactor * stemHeight;
      const zRot = (side === 1 ? -0.6 : 0.6);
      result.push({ position: [0, h, 0] as [number, number, number], side: side, rotationZ: zRot, hFactor: hFactor });
    }
    return result;
  }, [seed, stemHeight]);

  const petalWidth = useMemo(() => 0.7 + ((seed % 10) / 25.0), [seed]);
  const petalLength = useMemo(() => 1.1 + ((seed % 10) / 20.0), [seed]);
  const petalCurvature = useMemo(() => 0.2 + ((seed % 10) / 30.0), [seed]);

  useEffect(() => {
    let frameId: number;
    let start = Date.now();
    const duration = 2500;
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setGrowth(eased);
      if (progress < 1) frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <group position={position}>
      <group renderOrder={flowerRenderOrder + 0}>
        <StemAndLeaves 
          stemHeight={stemHeight} 
          growth={growth} 
          leaves={leaves} 
          stemTopColor={stemTopColor} 
          groundColor={groundColor} 
        />
      </group>
      <group position={[0, stemHeight * growth + 0.05, 0]}>
        <FlowerHead 
          growth={growth} 
          centerColor={centerColor} 
          petalCount={petalCount} 
          color={color} 
          secondaryColor={secondaryColor} 
          seed={seed} 
          petalWidth={petalWidth} 
          petalLength={petalLength} 
          petalCurvature={petalCurvature} 
          flowerSize={flowerSize}
          baseRenderOrder={flowerRenderOrder}
        />
      </group>
    </group>
  );
};

const GlowingParticles = ({ count, size, speed }: { count: number, size: number, speed: number }) => {
  const meshRef = useRef<THREE.Points>(null);
  
  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const randoms = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = Math.random() * 15;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
      
      randoms[i * 3] = Math.random();
      randoms[i * 3 + 1] = Math.random();
      randoms[i * 3 + 2] = Math.random();
    }
    return { positions, randoms };
  }, [count]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: size },
        uSpeed: { value: speed }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uSize;
        uniform float uSpeed;
        attribute vec3 aRandom;
        varying float vAlpha;
        varying vec3 vColor;
        
        void main() {
          vec3 pos = position;
          
          // Drifting motion
          pos.x += sin(uTime * uSpeed * 0.5 + aRandom.x * 10.0) * 2.0;
          pos.y += cos(uTime * uSpeed * 0.3 + aRandom.y * 10.0) * 2.0;
          pos.z += sin(uTime * uSpeed * 0.4 + aRandom.z * 10.0) * 2.0;
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = uSize * (300.0 / -mvPosition.z) * (0.8 + 0.2 * sin(uTime * 2.0 + aRandom.x * 10.0));
          gl_Position = projectionMatrix * mvPosition;
          
          // Shimmering alpha
          vAlpha = 0.4 + 0.6 * pow(0.5 + 0.5 * sin(uTime * 3.0 * uSpeed + aRandom.y * 20.0), 3.0);
          
          // Subtle color variation
          vColor = mix(vec3(1.0, 1.0, 0.8), vec3(0.7, 1.0, 0.9), aRandom.z);
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          float dist = distance(gl_PointCoord, vec2(0.5));
          if (dist > 0.5) discard;
          
          // Volumetric glow effect
          float glow = pow(1.0 - dist * 2.0, 2.0);
          gl_FragColor = vec4(vColor, glow * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [size, speed]);

  useFrame((state) => {
    if (material) {
      material.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry key={`particles-${count}`}>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          count={count}
          array={particles.randoms}
          itemSize={3}
        />
      </bufferGeometry>
      <primitive object={material} attach="material" />
    </points>
  );
};

const Scene = ({ flowers, groundColor, skyColor, stemTopColor, flowerSize, particleCount, particleSize, particleSpeed }: { flowers: FlowerData[], groundColor: string, skyColor: string, stemTopColor: string, flowerSize: number, particleCount: number, particleSize: number, particleSpeed: number }) => {
  const { scene } = useThree();
  const controlsRef = useRef<any>(null);
  
  useEffect(() => {
    scene.background = new THREE.Color(skyColor);
  }, [scene, skyColor]);

  useFrame(() => {
    if (flowers.length > 0 && controlsRef.current) {
      const center = new THREE.Vector3(0, 0, 0);
      flowers.forEach(f => {
        center.x += f.position[0];
        center.y += f.position[1] + 1.5;
        center.z += f.position[2];
      });
      center.divideScalar(flowers.length);
      controlsRef.current.target.lerp(center, 0.05);
      controlsRef.current.update();
    }
  });

  return (
    <>
      <OrbitControls 
        ref={controlsRef}
        enablePan={false} 
        minDistance={3} 
        maxDistance={25} 
        maxPolarAngle={Math.PI / 2.05} 
        makeDefault
      />
      <GlowingParticles count={particleCount} size={particleSize} speed={particleSpeed} />
      <Suspense fallback={null}>
        {flowers.map((f) => (
          <Float key={f.id} speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
            <Flower name={f.name} position={f.position} stemTopColor={stemTopColor} groundColor={groundColor} flowerSize={flowerSize} />
          </Float>
        ))}
      </Suspense>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} renderOrder={-1}>
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial color={groundColor} toneMapped={false} />
      </mesh>
      <fog attach="fog" args={[skyColor, 25, 60]} />
    </>
  );
};

// On tall (portrait) screens widen the vertical fov so the garden isn't cropped at the sides;
// landscape keeps the original 45deg.
const BASE_FOV = 45;
const MIN_HALF_WIDTH_TAN = 0.3;

const ResponsiveFov = () => {
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
};

interface FlowerData {
  id: string;
  name: string;
  position: [number, number, number];
}

export default function Component() {
  const [inputValue, setInputValue] = useState('');
  const [flowers, setFlowers] = useState<FlowerData[]>([]);
  const [uiHidden, setUiHidden] = useState(false);
  
  const skyColor = tweaks.skyColor.useState();
  const groundColor = tweaks.groundColor.useState();
  const inputPlaceholder = tweaks.inputPlaceholder.useState();
  const inputColor = tweaks.inputColor.useState();
  const inputSize = tweaks.inputSize.useState();
  const inputVisible = tweaks.inputVisible.useState();
  const hintText = tweaks.hintText.useState();
  const hintColor = tweaks.hintColor.useState();
  const hintSize = tweaks.hintSize.useState();
  const hintVisible = tweaks.hintVisible.useState();
  const gardenSpread = tweaks.gardenSpread.useState();
  const footerText = tweaks.footerText.useState();
  const footerColor = tweaks.footerColor.useState();
  const footerSize = tweaks.footerSize.useState();
  const footerVisible = tweaks.footerVisible.useState();
  const hideUIButton = tweaks.hideUIButton.useState();
  const hideUIButtonColor = tweaks.hideUIButtonColor.useState();
  const hideUIButtonSize = tweaks.hideUIButtonSize.useState();
  const hideUIButtonVisible = tweaks.hideUIButtonVisible.useState();
  const stemTopColor = tweaks.stemTopColor.useState();
  const flowerSize = tweaks.flowerSize.useState();
  const particleCount = tweaks.particleCount.useState();
  const particleSize = tweaks.particleSize.useState();
  const particleSpeed = tweaks.particleSpeed.useState();
  const titleText = tweaks.titleText.useState();
  const titleColor = tweaks.titleColor.useState();
  const titleSize = tweaks.titleSize.useState();
  const titleVisible = tweaks.titleVisible.useState();
  const tutorialText = tweaks.tutorialText.useState();
  const tutorialColor = tweaks.tutorialColor.useState();
  const tutorialSize = tweaks.tutorialSize.useState();
  const tutorialVisible = tweaks.tutorialVisible.useState();

  const addFlower = () => {
    const trimmed = inputValue.trim();
    if (trimmed.length === 0) return;
    const nameCount = flowers.filter(f => f.name.toLowerCase() === trimmed.toLowerCase()).length;
    const minDistance = 1.2;
    let bestPosition: [number, number, number] = [0, 0, 0];
    let foundSpot = false;
    let attempts = 0;
    const maxAttempts = 50;
    while (!foundSpot && attempts < maxAttempts) {
      const positionSeed = hashName(trimmed + "-inst-" + nameCount + "-" + flowers.length + "-" + attempts);
      const angle = (positionSeed % 360) * (Math.PI / 180);
      const radius = ((positionSeed % 100) / 100) * gardenSpread;
      const candidateX = Math.cos(angle) * radius;
      const candidateZ = Math.sin(angle) * radius;
      const isTooClose = flowers.some(f => {
        const dx = f.position[0] - candidateX;
        const dz = f.position[2] - candidateZ;
        return (dx * dx + dz * dz) < minDistance * minDistance;
      });
      if (!isTooClose || attempts === maxAttempts - 1) {
        bestPosition = [candidateX, 0, candidateZ];
        foundSpot = true;
      }
      attempts++;
    }
    const newFlower: FlowerData = { id: `${trimmed}-${Date.now()}-${flowers.length}`, name: trimmed, position: bestPosition };
    setFlowers(prev => [...prev, newFlower]);
    setInputValue('');
    gizmoRuntime.performHaptic('medium');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addFlower();
  };

  // Ignore the click that ends a drag (mouse-orbiting the garden shouldn't bring the UI back)
  const pointerDownAt = useRef<{ x: number, y: number } | null>(null);

  // Lift the input above the on-screen keyboard when the visual viewport shrinks
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setKeyboardInset(Math.max(0, Math.round(window.innerHeight - (vv.offsetTop + vv.height))));
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return (
    <div 
      className="h-screen w-screen overflow-hidden relative"
      onPointerDown={(e) => { pointerDownAt.current = { x: e.clientX, y: e.clientY }; }}
      onClick={(e) => {
        const start = pointerDownAt.current;
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) return;
        if (uiHidden) {
          setUiHidden(false);
          gizmoRuntime.performHaptic('light');
        }
      }}
    >
      <div aria-hidden className="fixed inset-0 -z-10" style={{ background: skyColor }} />
      <div className="absolute inset-0 cursor-grab active:cursor-grabbing">
        <Canvas camera={{ position: [0, 6, 12], fov: BASE_FOV }} dpr={[1, 2]} gl={{ antialias: true, outputColorSpace: THREE.SRGBColorSpace }}>
          <ResponsiveFov />
          <Scene 
            flowers={flowers} 
            groundColor={groundColor} 
            skyColor={skyColor} 
            stemTopColor={stemTopColor} 
            flowerSize={flowerSize}
            particleCount={particleCount}
            particleSize={particleSize}
            particleSpeed={particleSpeed}
          />
        </Canvas>
      </div>

      {/* Centered Title and Tutorial */}
      {flowers.length === 0 && !uiHidden && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
          {titleVisible && (
            <h1 
              className="font-bold mb-2 drop-shadow-lg animate-pulse max-w-3xl"
              style={{ color: titleColor, fontSize: `clamp(${titleSize}px, 3.2vw, ${titleSize * 1.75}px)`, lineHeight: 1.1 }}
            >
              {titleText}
            </h1>
          )}
          {tutorialVisible && (
            <p 
              className="opacity-80"
              style={{ color: tutorialColor, fontSize: `${tutorialSize}px` }}
            >
              {tutorialText}
            </p>
          )}
        </div>
      )}

      <div
        className="absolute left-0 w-full flex flex-col items-center z-10 pointer-events-none"
        style={{
          bottom: inputFocused && keyboardInset > 0
            ? `${keyboardInset + 16}px`
            : 'max(3rem, calc(env(safe-area-inset-bottom) + 1rem))',
        }}
      >
        {!uiHidden && inputVisible && (
          <div className="pointer-events-auto w-4/5 max-w-sm md:max-w-md flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder={inputPlaceholder}
              enterKeyHint="done"
              autoComplete="off"
              className="min-w-0 flex-1 px-6 py-4 rounded-full shadow-2xl outline-none text-center transition-all focus:scale-105"
              style={{ 
                color: '#FFFFFF', 
                fontSize: `${inputSize}px`,
                backgroundColor: '#000000',
                border: '2px solid #FFFFFF'
              }}
            />
            {hideUIButtonVisible && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setUiHidden(true);
                  gizmoRuntime.performHaptic('light');
                }}
                className="shrink-0 aspect-square h-full flex items-center justify-center rounded-full shadow-2xl border-2 border-white bg-black hover:scale-105 active:scale-90 transition-transform"
                style={{
                  color: hideUIButtonColor,
                  fontSize: `${hideUIButtonSize}px`,
                  width: '60px',
                  height: '60px',
                  fontWeight: 'bold'
                }}
              >
                {hideUIButton}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}