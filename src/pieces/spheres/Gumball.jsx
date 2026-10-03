import React, { useRef, useState, useMemo, Suspense, useEffect } from 'react';
import { budgetDpr } from '../../pixelBudget.js';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import * as Tone from 'tone';
import FitFov from './FitFov.js';

const generativeBackgroundShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color('#E93323') },
    uColor2: { value: new THREE.Color('#2227F5') },
    uColor3: { value: new THREE.Color('#E432B7') },
    uScale: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision mediump float;
    varying vec2 vUv;
    uniform float uTime;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform float uScale;

    void main() {
      vec2 uv = vUv * uScale;
      float t = uTime * 0.2;

      float noise = sin(uv.x * 3.0 + t) * cos(uv.y * 2.0 - t * 0.5) +
                    sin(uv.y * 4.0 + t * 0.8) * cos(uv.x * 3.0 + t * 1.2);

      vec3 color = mix(uColor1, uColor2, smoothstep(-1.0, 1.0, noise));
      color = mix(color, uColor3, smoothstep(0.5, 1.5, noise + sin(t * 0.3)));

      gl_FragColor = vec4(color, 1.0);
    }
  `
};

const glassVertexShader = `
  varying vec3 vNormal;
  varying vec3 vEyeVector;
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  varying vec3 vViewPosition;

  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vEyeVector = normalize(worldPosition.xyz - cameraPosition);
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const glassFragmentShader = `
  precision mediump float;

  uniform float uOpacity;
  uniform float uRefraction;
  uniform float uShininess;
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform float uScale;
  uniform vec2 uResolution;

  varying vec3 vNormal;
  varying vec3 vEyeVector;
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  varying vec3 vViewPosition;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 eye = normalize(vEyeVector);
    vec3 viewDir = normalize(vViewPosition);

    // Fresnel effect: Schlick's approximation
    float dotProduct = dot(normal, viewDir);
    float fresnelBase = 1.0 - max(dotProduct, 0.0);
    float fresnel = pow(fresnelBase, 3.0); // Slightly softer fresnel for more "body"

    // Refraction simulation
    vec3 refracted = refract(-viewDir, normal, 1.0 / (1.0 + uRefraction));

    // Screen-space background lookup
    vec2 screenUv = gl_FragCoord.xy / uResolution;
    vec2 lookupUv = screenUv + refracted.xy * uRefraction;
    lookupUv *= uScale;

    float t = uTime * 0.2;
    float noise = sin(lookupUv.x * 3.0 + t) * cos(lookupUv.y * 2.0 - t * 0.5) +
                  sin(lookupUv.y * 4.0 + t * 0.8) * cos(lookupUv.x * 3.0 + t * 1.2);

    vec3 refractedBg = mix(uColor1, uColor2, smoothstep(-1.0, 1.0, noise));
    refractedBg = mix(refractedBg, uColor3, smoothstep(0.5, 1.5, noise + sin(t * 0.3)));

    // Specular highlights (simulating multiple light sources for extra shine)
    vec3 light1 = normalize(vec3(5.0, 10.0, 7.0));
    vec3 light2 = normalize(vec3(-5.0, 5.0, 2.0));
    vec3 light3 = normalize(vec3(0.0, -5.0, 5.0));

    vec3 reflectDir = reflect(-viewDir, normal);

    // Sharp, bright highlights
    float spec1 = pow(max(dot(reflectDir, light1), 0.0), 128.0);
    float spec2 = pow(max(dot(reflectDir, light2), 0.0), 64.0);
    float spec3 = pow(max(dot(reflectDir, light3), 0.0), 32.0);

    // Reflection color
    vec3 reflection = vec3(1.0);

    // Final composition
    vec3 color = refractedBg;

    // Add fresnel reflection at edges
    color = mix(color, reflection, fresnel * 0.8 * uShininess);

    // Add sharp specular highlights
    color += reflection * spec1 * 2.0 * uShininess;
    color += vec3(0.9, 0.95, 1.0) * spec2 * 1.0 * uShininess;
    color += vec3(1.0, 1.0, 1.0) * spec3 * 0.3 * uShininess;

    // Opacity: Glass is mostly transparent in the middle, more visible at edges
    float alpha = mix(uOpacity * 0.1, 0.8, fresnel);

    gl_FragColor = vec4(color, alpha);
  }
`;

const gumballVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = instanceMatrix * modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vNormal = normalize(mat3(instanceMatrix) * normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const gumballFragmentShader = `
  precision mediump float;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;

  uniform vec3 uLightPos;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Use instance color passed by Three.js
    // In custom shaders with InstancedMesh, we need to handle color manually
    // or use the built-in attribute. Since we're using a custom shader,
    // we'll use the varying color if we set it up, but for simplicity
    // let's use the gl_FrontFacing or a passed uniform if needed.
    // Actually, Three.js passes instanceColor as an attribute 'instanceColor'.

    // For now, let's assume we want a nice waxy gumball look.
    // We'll use a simple diffuse + specular + rim light.

    vec3 lightDir = normalize(uLightPos - vWorldPosition);
    vec3 halfDir = normalize(lightDir + viewDir);

    float diffuse = max(dot(normal, lightDir), 0.0);
    float specular = pow(max(dot(normal, halfDir), 0.0), 32.0);
    float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);

    // Base color from instance attribute (provided by Three.js)
    // Note: In WebGL 1.0 / Three.js custom shaders, we need to declare attribute vec3 instanceColor;
    // but Three.js handles this if we use the right hooks.
    // To keep it simple and robust, we'll use a fallback if attribute isn't there.

    vec3 baseColor = vec3(1.0); // Fallback
    #ifdef USE_INSTANCING_COLOR
      // This is a Three.js internal define
    #endif

    // Since we can't easily access instanceColor in a raw ShaderMaterial without more setup,
    // let's use MeshStandardMaterial but with better properties,
    // OR we can stick to MeshStandardMaterial and just fix the "dull" look
    // by adjusting its properties and the scene lighting.

    // Actually, the user wants them to look like "physical gumballs".
    // Let's use MeshPhysicalMaterial or MeshStandardMaterial with high clearcoat.

    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // Placeholder
  }
`;

function PhysicsScene({ sphereOpacity, sphereRefraction, sphereShininess, bounciness, gravity, friction, rotationSpeed, ballCount, sphereSize, ballSize, sphereThickness, palette, bgColor1, bgColor2, bgColor3, bgScale, bgSpeed, gumballRoughness, gumballMetalness, gumballClearcoat }) {
  const sphereRef = useRef(null);
  const instancedMeshRef = useRef(null);

  // Audio setup
  const synth = useRef(null);
  const [audioReady, setAudioReady] = useState(false);

  // C Major Pentatonic scale for harmonious blips
  const PENTATONIC = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5'];

  useEffect(() => {
    const reverb = new Tone.Reverb({ decay: 2, wet: 0.3 }).toDestination();
    const delay = new Tone.FeedbackDelay('8n', 0.2).connect(reverb);

    synth.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0.0,
        release: 0.1
      }
    }).connect(delay);

    return () => {
      synth.current?.dispose();
      reverb.dispose();
      delay.dispose();
    };
  }, []);

  const playBlip = (velocity) => {
    if (!audioReady || !synth.current) return;

    // Map velocity to note index
    const noteIndex = Math.floor(Math.min(velocity * 0.5, PENTATONIC.length - 1));
    const note = PENTATONIC[noteIndex];

    // Volume based on impact
    const volume = Math.min(Math.max((velocity - 2) / 10, 0.1), 1.0);

    try {
      synth.current.triggerAttackRelease(note, '32n', undefined, volume);
    } catch (e) {
      console.error('Audio trigger error', e);
    }
  };

  // Called from pointerdown and pointerup: mobile browsers only count the touch's
  // pointerup as a user gesture for unlocking audio, desktop counts the mousedown.
  const startAudio = async () => {
    if (!audioReady) {
      await Tone.start();
      setAudioReady(true);
    }
  };

  const glassUniforms = useMemo(() => ({
    uOpacity: { value: sphereOpacity },
    uRefraction: { value: sphereRefraction },
    uShininess: { value: sphereShininess },
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(bgColor1) },
    uColor2: { value: new THREE.Color(bgColor2) },
    uColor3: { value: new THREE.Color(bgColor3) },
    uScale: { value: bgScale },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
  }), []);

  useFrame((state) => {
    glassUniforms.uOpacity.value = sphereOpacity;
    glassUniforms.uRefraction.value = sphereRefraction;
    glassUniforms.uShininess.value = sphereShininess;
    glassUniforms.uColor1.value.set(bgColor1);
    glassUniforms.uColor2.value.set(bgColor2);
    glassUniforms.uColor3.value.set(bgColor3);
    glassUniforms.uScale.value = bgScale;
    glassUniforms.uTime.value = state.clock.getElapsedTime() * bgSpeed;
    // gl_FragCoord is in device pixels, so match the canvas's pixel ratio.
    glassUniforms.uResolution.value.set(size.width * state.viewport.dpr, size.height * state.viewport.dpr);
  });

  // Physics state for all balls
  const balls = useMemo(() => {
    const data = [];
    for (let i = 0; i < 100; i++) { // Max 100 balls
      data.push({
        pos: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 4
        ),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10
        ),
        colorIndex: Math.floor(Math.random() * palette.length)
      });
    }
    return data;
  }, [palette.length]);

  // Rotation state
  const rotation = useRef(new THREE.Euler(0, 0, 0));
  const targetRotation = useRef(new THREE.Euler(0, 0, 0));
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const { size, gl } = useThree();

  const handlePointerDown = (e) => {
    e.target.setPointerCapture?.(e.pointerId);
    gl.domElement.style.cursor = 'grabbing';
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const dx = (e.clientX - lastMouse.current.x) / size.width;
    const dy = (e.clientY - lastMouse.current.y) / size.height;

    targetRotation.current.y += dx * rotationSpeed;
    targetRotation.current.x += dy * rotationSpeed;

    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = () => {
    gl.domElement.style.cursor = '';
    isDragging.current = false;
  };

  // Update colors for instanced mesh when palette changes
  useEffect(() => {
    if (instancedMeshRef.current) {
      for (let i = 0; i < balls.length; i++) {
        const color = new THREE.Color(palette[balls[i].colorIndex]);
        instancedMeshRef.current.setColorAt(i, color);
      }
      instancedMeshRef.current.instanceColor.needsUpdate = true;
    }
  }, [balls, palette]);

  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempPos = useMemo(() => new THREE.Vector3(), []);
  const tempVel = useMemo(() => new THREE.Vector3(), []);
  const tempNormal = useMemo(() => new THREE.Vector3(), []);
  const tempDiff = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    if (!sphereRef.current || !instancedMeshRef.current) return;

    const dt = Math.min(delta, 0.032);
    const subSteps = 4;
    const subDt = dt / subSteps;

    rotation.current.x = THREE.MathUtils.lerp(rotation.current.x, targetRotation.current.x, 0.1);
    rotation.current.y = THREE.MathUtils.lerp(rotation.current.y, targetRotation.current.y, 0.1);
    sphereRef.current.rotation.copy(rotation.current);

    const angularVelX = (targetRotation.current.x - rotation.current.x) / dt;
    const angularVelY = (targetRotation.current.y - rotation.current.y) / dt;

    for (let step = 0; step < subSteps; step++) {
      for (let i = 0; i < ballCount; i++) {
        const ball = balls[i];
        ball.vel.y -= gravity * subDt;
        ball.vel.multiplyScalar(Math.pow(friction, subDt * 60));
        ball.pos.addScaledVector(ball.vel, subDt);

        const distFromCenter = ball.pos.length();
        // The collision boundary is the inner surface of the sphere.
        // If sphereSize is the outer radius, the inner radius is sphereSize - sphereThickness.
        const innerRadius = sphereSize - sphereThickness;
        const maxDist = innerRadius - ballSize;

        if (distFromCenter > maxDist) {
          tempNormal.copy(ball.pos).normalize();
          ball.pos.copy(tempNormal).multiplyScalar(maxDist);

          const dot = ball.vel.dot(tempNormal);
          if (dot > 0) {
            ball.vel.addScaledVector(tempNormal, -2 * dot);
            ball.vel.multiplyScalar(bounciness);

            const spinVelocity = new THREE.Vector3(
              angularVelY * ball.pos.z,
              -angularVelX * ball.pos.z,
              -angularVelY * ball.pos.x + angularVelX * ball.pos.y
            ).multiplyScalar(0.05);

            ball.vel.add(spinVelocity);

            if (step === 0 && Math.abs(dot) > 2) {
              playBlip(Math.abs(dot));
            }
          }
        }

        for (let j = i + 1; j < ballCount; j++) {
          const other = balls[j];
          tempDiff.subVectors(ball.pos, other.pos);
          const distSq = tempDiff.lengthSq();
          const minDist = ballSize * 2;
          const minDistSq = minDist * minDist;

          if (distSq < minDistSq) {
            const dist = Math.sqrt(distSq);
            const collisionNormal = tempDiff.divideScalar(dist || 1);
            const relativeVelocity = tempVel.subVectors(ball.vel, other.vel);
            const velocityAlongNormal = relativeVelocity.dot(collisionNormal);

            if (velocityAlongNormal < 0) {
              const restitution = bounciness;
              const impulseScalar = -(1 + restitution) * velocityAlongNormal / 2;
              const impulse = collisionNormal.clone().multiplyScalar(impulseScalar);

              ball.vel.add(impulse);
              other.vel.sub(impulse);

              if (step === 0 && Math.abs(velocityAlongNormal) > 4) {
                playBlip(Math.abs(velocityAlongNormal));
              }

              const overlap = minDist - dist;
              const percent = 0.5;
              const slop = 0.01;
              const correction = Math.max(overlap - slop, 0) * percent;
              const correctionVec = collisionNormal.multiplyScalar(correction);
              ball.pos.add(correctionVec);
              other.pos.sub(correctionVec);
            }
          }
        }
      }
    }

    for (let i = 0; i < 100; i++) {
      if (i >= ballCount) {
        tempMatrix.makeScale(0, 0, 0);
        tempMatrix.setPosition(0, 1000, 0);
      } else {
        const ball = balls[i];
        tempMatrix.makeScale(ballSize / 0.35, ballSize / 0.35, ballSize / 0.35);
        tempMatrix.setPosition(ball.pos);
      }
      instancedMeshRef.current.setMatrixAt(i, tempMatrix);
    }

    instancedMeshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <mesh
        position={[0, 0, 0]}
        onPointerDown={(e) => {
          handlePointerDown(e);
          startAudio();
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => {
          handlePointerUp(e);
          startAudio();
        }}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        visible={false}
      >
        <planeGeometry args={[100, 100]} />
      </mesh>

      <group ref={sphereRef}>
        {/* Back surface of the sphere (rendered behind balls) */}
        <mesh renderOrder={0}>
          <sphereGeometry args={[sphereSize, 64, 64]} />
          <shaderMaterial
            vertexShader={glassVertexShader}
            fragmentShader={glassFragmentShader}
            transparent={true}
            side={THREE.BackSide}
            uniforms={glassUniforms}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Balls rendered in the middle */}
      <instancedMesh ref={instancedMeshRef} args={[null, null, 100]} castShadow renderOrder={1}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshPhysicalMaterial
          roughness={gumballRoughness}
          metalness={gumballMetalness}
          clearcoat={gumballClearcoat}
          clearcoatRoughness={0.05}
          reflectivity={1.0}
          envMapIntensity={1.5}
        />
      </instancedMesh>

      {/* Front surface of the sphere (rendered over balls) */}
      <mesh rotation={rotation.current} renderOrder={2}>
        <sphereGeometry args={[sphereSize, 64, 64]} />
        <shaderMaterial
          vertexShader={glassVertexShader}
          fragmentShader={glassFragmentShader}
          transparent={true}
          side={THREE.FrontSide}
          uniforms={glassUniforms}
        />
      </mesh>
    </>
  );
}

function Background({ color1, color2, color3, scale, speed }) {
  const meshRef = useRef(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(color1) },
    uColor2: { value: new THREE.Color(color2) },
    uColor3: { value: new THREE.Color(color3) },
    uScale: { value: scale },
  }), []);

  useFrame((state) => {
    uniforms.uColor1.value.set(color1);
    uniforms.uColor2.value.set(color2);
    uniforms.uColor3.value.set(color3);
    uniforms.uScale.value = scale;
    uniforms.uTime.value = state.clock.getElapsedTime() * speed;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -10]}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={generativeBackgroundShader.vertexShader}
        fragmentShader={generativeBackgroundShader.fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
      />
    </mesh>
  );
}

export default function Component() {
  const sphereOpacity = 0.0;
  const sphereRefraction = 0.5;
  const sphereShininess = 0.2;
  const bounciness = 0.76;
  const gravity = 30.0;
  const friction = 0.995;
  const rotationSpeed = 2.6;
  const ballCount = 100;
  const sphereSize = 3.1;
  const ballSize = 0.42;
  const sphereThickness = 0.1;
  const bgScale = 2.4;
  const bgSpeed = 2.0;
  const bgColor1 = "#FFB4E5";
  const bgColor2 = "#FFFF9A";
  const bgColor3 = "#DBFFCC";

  const gumballRoughness = 1.0;
  const gumballMetalness = 0.0;
  const gumballClearcoat = 0.0;

  const color1 = "#FFF73C";
  const color2 = "#32FF86";
  const color3 = "#40D9FF";
  const color4 = "#CA75FF";
  const color5 = "#FF5CA4";
  const color6 = "#FFFFFF";

  const palette = useMemo(() => [
    color1, color2, color3, color4, color5, color6
  ], [color1, color2, color3, color4, color5, color6]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#000', overflow: 'hidden', position: 'relative', cursor: 'grab' }}>
      <Canvas
        dpr={budgetDpr()}
        shadows
        camera={{ position: [0, 0, 15], fov: 45 }}
        gl={{ antialias: true }}
      >
        <FitFov fov={45} minAspect={0.62} />
        <ambientLight intensity={0.8} />
        <pointLight position={[10, 10, 10]} intensity={3.5} />
        <pointLight position={[-10, 5, 5]} intensity={2.0} color="#ffffff" />
        <pointLight position={[0, -10, 0]} intensity={1.0} />
        <spotLight position={[5, 20, 5]} angle={0.3} penumbra={1} intensity={5} castShadow />
        <directionalLight position={[0, 5, 10]} intensity={1.5} />

        <Suspense fallback={null}>
          <Background color1={bgColor1} color2={bgColor2} color3={bgColor3} scale={bgScale} speed={bgSpeed} />
          <PhysicsScene
            sphereOpacity={sphereOpacity}
            sphereRefraction={sphereRefraction}
            sphereShininess={sphereShininess}
            bounciness={bounciness}
            gravity={gravity}
            friction={friction}
            rotationSpeed={rotationSpeed}
            ballCount={ballCount}
            sphereSize={sphereSize}
            ballSize={ballSize}
            sphereThickness={sphereThickness}
            palette={palette}
            bgColor1={bgColor1}
            bgColor2={bgColor2}
            bgColor3={bgColor3}
            bgScale={bgScale}
            bgSpeed={bgSpeed}
            gumballRoughness={gumballRoughness}
            gumballMetalness={gumballMetalness}
            gumballClearcoat={gumballClearcoat}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
