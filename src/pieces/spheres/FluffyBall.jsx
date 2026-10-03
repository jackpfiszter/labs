import React, { useRef, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const DEFAULTS = {
  hairBaseColor: "#000000",
  hairMidColor: "#80005D",
  hairTipColor: "#FF0064",
  bgInnerColor: "#FFFFFF",
  bgOuterColor: "#F9D253",
  bgTransition: 76.0,
  bgVisible: true,
  hairCount: 800,
  hairLength: 1.1,
  hairWidth: 0.099999994,
  stiffness: 0.02,
  damping: 0.88,
  gravity: 0.0,
  rotationInertia: 0.96,
  lengthRandomness: 0.3,
  clumping: 0.0,
  curliness: 0.45000002,
  idleMovement: 0.05,
  cameraDistance: 7.5,
};

const SEGMENTS_PER_HAIR = 10;

function CameraUpdater({ distance }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.z = distance;
    camera.updateProjectionMatrix();
  }, [distance, camera]);
  return null;
}

function FluffySphere() {
  const { gl, camera } = useThree();
  const groupRef = useRef(null);
  const hairMeshRef = useRef(null);

  const hairBaseColor = DEFAULTS.hairBaseColor;
  const hairMidColor = DEFAULTS.hairMidColor;
  const hairTipColor = DEFAULTS.hairTipColor;
  const hairWidth = DEFAULTS.hairWidth;
  const hairCount = DEFAULTS.hairCount;
  const hairLength = DEFAULTS.hairLength;
  const stiffness = DEFAULTS.stiffness;
  const damping = DEFAULTS.damping;
  const gravity = DEFAULTS.gravity;
  const rotationInertia = DEFAULTS.rotationInertia;
  const lengthRandomness = DEFAULTS.lengthRandomness;
  const clumping = DEFAULTS.clumping;
  const curliness = DEFAULTS.curliness;
  const idleMovement = DEFAULTS.idleMovement;

  const isDragging = useRef(false);
  const lastTouch = useRef({ x: 0, y: 0 });
  const rotationVelocity = useRef({ x: 0, y: 0 });
  const currentRotation = useRef({ x: 0, y: 0 });

  // Physics state
  const physicsData = useMemo(() => {
    const roots = [];
    const positions = [];
    const velocities = [];

    for (let i = 0; i < hairCount; i++) {
      // Fibonacci sphere distribution with a bit of jitter for organic feel
      const phi = Math.acos(-1 + (2 * i) / hairCount);
      const theta = Math.sqrt(hairCount * Math.PI) * phi;

      // Add slight jitter to root positions
      const jitter = 0.02;
      const root = new THREE.Vector3(
        Math.cos(theta) * Math.sin(phi) + (Math.random() - 0.5) * jitter,
        Math.sin(theta) * Math.sin(phi) + (Math.random() - 0.5) * jitter,
        Math.cos(phi) + (Math.random() - 0.5) * jitter
      ).normalize();

      roots.push(root.clone());

      const hairPos = [];
      const hairVel = [];

      const randomFactor = 1.0 - (Math.random() * lengthRandomness);
      const individualLength = hairLength * randomFactor;
      const segmentLen = individualLength / SEGMENTS_PER_HAIR;

      // Pre-calculate a "clump target" for this hair
      // We use a lower-frequency noise-like approach by rounding the root
      const clumpGrid = 4;
      const clumpTarget = new THREE.Vector3(
        Math.round(root.x * clumpGrid) / clumpGrid,
        Math.round(root.y * clumpGrid) / clumpGrid,
        Math.round(root.z * clumpGrid) / clumpGrid
      ).normalize();

      // Pre-calculate a curl offset
      const curlOffset = new THREE.Vector3(
        (Math.random() - 0.5),
        (Math.random() - 0.5),
        (Math.random() - 0.5)
      ).normalize();

      for (let j = 0; j <= SEGMENTS_PER_HAIR; j++) {
        const p = root.clone().multiplyScalar(1 + j * segmentLen);

        // Apply initial clumping and curl to the rest positions
        if (j > 0) {
          const t = j / SEGMENTS_PER_HAIR;
          // Pull towards clump target
          p.lerp(clumpTarget.clone().multiplyScalar(p.length()), t * clumping * 0.5);
          // Add some curl/noise
          p.add(curlOffset.clone().multiplyScalar(t * t * curliness * 0.2));
        }

        hairPos.push(p);
        hairVel.push(new THREE.Vector3(0, 0, 0));
      }
      positions.push(hairPos);
      velocities.push(hairVel);
    }
    return { roots, positions, velocities };
  }, [hairCount, hairLength, lengthRandomness, clumping, curliness]);

  // Geometry setup
  const hairGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    // Each hair is a continuous ribbon of triangles
    // 2 triangles per segment = 6 vertices per segment
    const totalVertices = hairCount * SEGMENTS_PER_HAIR * 6;
    const positions = new Float32Array(totalVertices * 3);
    const colors = new Float32Array(totalVertices * 3);

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
  }, [hairCount]);

  // Update colors when hair colors change
  useEffect(() => {
    if (!hairMeshRef.current) return;
    const colorsAttr = hairMeshRef.current.geometry.attributes.color;
    const baseColor = new THREE.Color(hairBaseColor);
    const midColor = new THREE.Color(hairMidColor);
    const tipColor = new THREE.Color(hairTipColor);

    let colorIdx = 0;
    for (let i = 0; i < hairCount; i++) {
      for (let j = 0; j < SEGMENTS_PER_HAIR; j++) {
        const tStart = j / SEGMENTS_PER_HAIR;
        const tEnd = (j + 1) / SEGMENTS_PER_HAIR;

        const getGradientColor = (t) => {
          // Use a smoothstep-like interpolation for softer transitions
          const smoothT = t * t * (3 - 2 * t);
          if (smoothT < 0.5) {
            return baseColor.clone().lerp(midColor, smoothT * 2);
          } else {
            return midColor.clone().lerp(tipColor, (smoothT - 0.5) * 2);
          }
        };

        const cStart = getGradientColor(tStart);
        const cEnd = getGradientColor(tEnd);

        // Triangle 1 (v1, v2, v3)
        colorsAttr.setXYZ(colorIdx++, cStart.r, cStart.g, cStart.b);
        colorsAttr.setXYZ(colorIdx++, cStart.r, cStart.g, cStart.b);
        colorsAttr.setXYZ(colorIdx++, cEnd.r, cEnd.g, cEnd.b);
        // Triangle 2 (v2, v4, v3)
        colorsAttr.setXYZ(colorIdx++, cStart.r, cStart.g, cStart.b);
        colorsAttr.setXYZ(colorIdx++, cEnd.r, cEnd.g, cEnd.b);
        colorsAttr.setXYZ(colorIdx++, cEnd.r, cEnd.g, cEnd.b);
      }
    }
    colorsAttr.needsUpdate = true;
  }, [hairBaseColor, hairMidColor, hairTipColor, hairCount]);

  useEffect(() => {
    const canvas = gl.domElement;

    const onMouseDown = (e) => {
      isDragging.current = true;
      lastTouch.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (e) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastTouch.current.x;
      const dy = e.clientY - lastTouch.current.y;
      rotationVelocity.current.y = dx * 0.01;
      rotationVelocity.current.x = dy * 0.01;
      lastTouch.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => { isDragging.current = false; };

    const onTouchStart = (e) => {
      isDragging.current = true;
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchMove = (e) => {
      if (!isDragging.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - lastTouch.current.x;
      const dy = touch.clientY - lastTouch.current.y;
      rotationVelocity.current.y = dx * 0.01;
      rotationVelocity.current.x = dy * 0.01;
      lastTouch.current = { x: touch.clientX, y: touch.clientY };
    };
    const onTouchEnd = () => { isDragging.current = false; };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [gl]);

  useFrame((state, delta) => {
    if (!groupRef.current || !hairMeshRef.current) return;

    currentRotation.current.x += rotationVelocity.current.x;
    currentRotation.current.y += rotationVelocity.current.y;
    groupRef.current.rotation.x = currentRotation.current.x;
    groupRef.current.rotation.y = currentRotation.current.y;

    if (!isDragging.current) {
      rotationVelocity.current.x *= rotationInertia;
      rotationVelocity.current.y *= rotationInertia;
    }

    const sphereMatrix = groupRef.current.matrixWorld;
    const positionsAttr = hairMeshRef.current.geometry.attributes.position;

    let attrIdx = 0;
    const tempVec = new THREE.Vector3();
    const tempRoot = new THREE.Vector3();
    const gravityVec = new THREE.Vector3(0, -gravity, 0);
    const currentNormal = new THREE.Vector3();
    const spherePos = new THREE.Vector3();
    groupRef.current.getWorldPosition(spherePos);

    const camPos = camera.position;
    const time = state.clock.getElapsedTime();

    for (let i = 0; i < hairCount; i++) {
      const rootLocal = physicsData.roots[i];
      const hairPos = physicsData.positions[i];
      const hairVel = physicsData.velocities[i];

      const segmentLen = hairPos[0].distanceTo(hairPos[1]);

      tempRoot.copy(rootLocal).applyMatrix4(sphereMatrix);
      currentNormal.copy(tempRoot).sub(spherePos).normalize();
      hairPos[0].copy(tempRoot);

      // Idle movement: subtle swaying based on time and position
      const idleForce = new THREE.Vector3();
      if (idleMovement > 0) {
        const noiseScale = 0.5;
        const noiseSpeed = 1.2;
        idleForce.set(
          Math.sin(time * noiseSpeed + rootLocal.x * noiseScale + i),
          Math.cos(time * noiseSpeed * 0.8 + rootLocal.y * noiseScale + i),
          Math.sin(time * noiseSpeed * 1.1 + rootLocal.z * noiseScale + i)
        ).multiplyScalar(idleMovement * 0.002);
      }

      // Clumping and Curliness logic
      const clumpGrid = 4;
      const clumpTarget = new THREE.Vector3(
        Math.round(rootLocal.x * clumpGrid) / clumpGrid,
        Math.round(rootLocal.y * clumpGrid) / clumpGrid,
        Math.round(rootLocal.z * clumpGrid) / clumpGrid
      ).normalize().applyMatrix4(sphereMatrix);

      const curlSeed = i * 0.5;
      const curlOffset = new THREE.Vector3(
        Math.sin(curlSeed),
        Math.cos(curlSeed * 1.1),
        Math.sin(curlSeed * 0.7)
      ).normalize();

      for (let j = 1; j <= SEGMENTS_PER_HAIR; j++) {
        const p = hairPos[j];
        const v = hairVel[j];
        const prevP = hairPos[j - 1];

        v.add(gravityVec);
        v.add(idleForce);

        // Target position based on normal + clumping + curliness
        const t = j / SEGMENTS_PER_HAIR;
        const targetPos = currentNormal.clone().multiplyScalar(segmentLen).add(prevP);

        // Apply clumping: pull towards the clump target line
        if (clumping > 0) {
          const idealClumpPos = clumpTarget.clone().sub(spherePos).normalize().multiplyScalar(segmentLen).add(prevP);
          targetPos.lerp(idealClumpPos, clumping * t);
        }

        // Apply curliness: add a spiral/noise offset
        if (curliness > 0) {
          targetPos.add(curlOffset.clone().multiplyScalar(curliness * segmentLen * t));
        }

        tempVec.copy(targetPos).sub(p).multiplyScalar(stiffness);
        v.add(tempVec);
        v.multiplyScalar(damping);
        p.add(v);

        tempVec.copy(p).sub(spherePos);
        const distFromCenter = tempVec.length();
        const minRadius = 1.02;
        if (distFromCenter < minRadius) {
          tempVec.normalize().multiplyScalar(minRadius);
          p.copy(spherePos).add(tempVec);
          const normal = tempVec.clone().normalize();
          const dot = v.dot(normal);
          if (dot < 0) {
            v.sub(normal.multiplyScalar(dot));
          }
        }

        tempVec.copy(p).sub(prevP);
        const dist = tempVec.length();
        if (dist > 0) {
          const diff = (dist - segmentLen) / dist;
          tempVec.multiplyScalar(diff);
          p.sub(tempVec);
          v.sub(tempVec.multiplyScalar(0.5));
        }
      }

      // Render as continuous ribbon of triangles
      for (let j = 0; j < SEGMENTS_PER_HAIR; j++) {
        const p1 = hairPos[j];
        const p2 = hairPos[j + 1];

        // Calculate side vectors for both points to ensure they align perfectly
        const up1 = new THREE.Vector3().copy(p2).sub(p1).normalize();
        const side1 = new THREE.Vector3().copy(camPos).sub(p1).cross(up1).normalize();

        // For the next segment's start, we need to know its orientation
        // If it's the last segment, we just use the same orientation
        let side2;
        if (j < SEGMENTS_PER_HAIR - 1) {
          const p3 = hairPos[j + 2];
          const up2 = new THREE.Vector3().copy(p3).sub(p2).normalize();
          side2 = new THREE.Vector3().copy(camPos).sub(p2).cross(up2).normalize();
        } else {
          side2 = side1.clone();
        }

        const w1 = hairWidth * (1 - j / SEGMENTS_PER_HAIR);
        const w2 = hairWidth * (1 - (j + 1) / SEGMENTS_PER_HAIR);

        // Vertices for current segment
        const v1x = p1.x + side1.x * w1, v1y = p1.y + side1.y * w1, v1z = p1.z + side1.z * w1;
        const v2x = p1.x - side1.x * w1, v2y = p1.y - side1.y * w1, v2z = p1.z - side1.z * w1;
        const v3x = p2.x + side2.x * w2, v3y = p2.y + side2.y * w2, v3z = p2.z + side2.z * w2;
        const v4x = p2.x - side2.x * w2, v4y = p2.y - side2.y * w2, v4z = p2.z - side2.z * w2;

        // Triangle 1 (v1, v2, v3)
        positionsAttr.setXYZ(attrIdx++, v1x, v1y, v1z);
        positionsAttr.setXYZ(attrIdx++, v2x, v2y, v2z);
        positionsAttr.setXYZ(attrIdx++, v3x, v3y, v3z);
        // Triangle 2 (v2, v4, v3)
        positionsAttr.setXYZ(attrIdx++, v2x, v2y, v2z);
        positionsAttr.setXYZ(attrIdx++, v4x, v4y, v4z);
        positionsAttr.setXYZ(attrIdx++, v3x, v3y, v3z);
      }
    }
    positionsAttr.needsUpdate = true;
  });

  return (
    <>
      <group ref={groupRef}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[1, 32, 32]} />
          <meshBasicMaterial color={hairBaseColor} />
        </mesh>
      </group>
      <mesh ref={hairMeshRef} geometry={hairGeometry}>
        <meshBasicMaterial attach="material" vertexColors side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

function Scene() {
  const bgInnerColor = DEFAULTS.bgInnerColor;
  const bgOuterColor = DEFAULTS.bgOuterColor;
  const bgTransition = DEFAULTS.bgTransition;
  const bgVisible = DEFAULTS.bgVisible;
  const cameraDistance = DEFAULTS.cameraDistance;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {bgVisible && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at center, ${bgInnerColor} 0%, ${bgOuterColor} ${bgTransition}%)`
          }}
        />
      )}
      <Canvas shadows camera={{ position: [0, 0, cameraDistance], fov: 45 }} gl={{ alpha: true }}>
        <CameraUpdater distance={cameraDistance} />
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1.5} castShadow />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <Suspense fallback={null}>
          <FluffySphere />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default function Component() {
  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, width: '100%', position: 'relative', minHeight: 0 }}>
        <Scene />
      </div>
    </div>
  );
}
