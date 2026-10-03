import React, { useRef, useMemo, useState, useEffect } from 'react';
import { budgetDpr } from '../../pixelBudget.js';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Trail } from '@react-three/drei';
import * as THREE from 'three';
import { gizmoRuntime } from '@gizmo/runtime';
import FitFov from './FitFov.js';

const tweaks = gizmoRuntime.tweaks({
  nucleusColor: { type: 'color', value: "#FFDD46", name: 'Nucleus', index: 0 },
  backgroundColor: { type: 'color', value: "#00052E", name: 'Background', index: 3 },
  cameraOrbitSpeed: { type: 'slider', value: 5.0, min: 0.1, max: 5, step: 0.1, name: 'Camera Orbit Speed', index: 4 },
  electronOrbitSpeed: { type: 'slider', value: 10.0, min: 0.1, max: 10, step: 0.1, name: 'Electron Orbit Speed', index: 5 },
  electronSize: { type: 'slider', value: 0.05, min: 0.05, max: 0.5, step: 0.01, name: 'Electron Size', index: 6 },
  nucleusSize: { type: 'slider', value: 0.1, min: 0.1, max: 1.5, step: 0.01, name: 'Nucleus Size', index: 7 },
  trailLength: { type: 'slider', value: 3.0, min: 1, max: 50, step: 1, name: 'Trail Length', index: 8 },
});

// Function to generate triadic colors
const getTriadicColors = (hue) => {
  const colors = [];
  for (let i = 0; i < 3; i++) {
    const newHue = (hue + i * 120) % 360;
    colors.push(new THREE.Color(`hsl(${newHue}, 100%, 50%)`));
  }
  return colors;
};

// Electron model
const Electron = ({ color, trailColor, orbitRadius, electronOrbitSpeed, offsetAngle }) => {
  const electronRef = useRef<THREE.Mesh>(null!);
  const electronSize = tweaks.electronSize.useState();
  const trailLength = tweaks.trailLength.useState();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * electronOrbitSpeed + offsetAngle;
    const x = orbitRadius * Math.cos(t);
    const z = orbitRadius * Math.sin(t);
    
    // Create a tilted orbit by rotating the position vector
    const yRotation = new THREE.Matrix4().makeRotationY(offsetAngle);
    const xRotation = new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(60));
    
    const position = new THREE.Vector3(x, 0, z);
    position.applyMatrix4(xRotation).applyMatrix4(yRotation);

    if (electronRef.current) {
      electronRef.current.position.copy(position);
    }
  });

  return (
    <group>
      <mesh ref={electronRef}>
        <sphereGeometry args={[electronSize, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Trail
        width={2}
        length={trailLength}
        color={trailColor}
        attenuation={(t) => t * t}
        target={electronRef}
      />
    </group>
  );
};

// Nucleus model
const Nucleus = () => {
  const nucleusSize = tweaks.nucleusSize.useState();
  const nucleusColor = tweaks.nucleusColor.useState();
  return (
    <mesh>
      <sphereGeometry args={[nucleusSize, 32, 32]} />
      <meshStandardMaterial color={nucleusColor} emissive={nucleusColor} emissiveIntensity={0.5} />
    </mesh>
  );
};

// Scene setup
const Scene = () => {
  const electronOrbitSpeed = tweaks.electronOrbitSpeed.useState();
  const cameraOrbitSpeed = tweaks.cameraOrbitSpeed.useState();
  const [electronColors, setElectronColors] = useState([
    new THREE.Color('#E93323'),
    new THREE.Color('#2227F5'),
    new THREE.Color('#75F94C'),
  ]);

  useFrame(({ clock }) => {
    // Cycle through hues over time
    const hue = (clock.getElapsedTime() * 5) % 360; // Slower cycle
    const newColors = getTriadicColors(hue);
    setElectronColors(newColors);
  });

  return (
    <>
      <ambientLight intensity={0.7} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
      <Nucleus />
      <Electron color={electronColors[0]} trailColor={electronColors[0]} orbitRadius={3} electronOrbitSpeed={electronOrbitSpeed} offsetAngle={0} />
      <Electron color={electronColors[1]} trailColor={electronColors[1]} orbitRadius={3} electronOrbitSpeed={electronOrbitSpeed} offsetAngle={THREE.MathUtils.degToRad(120)} />
      <Electron color={electronColors[2]} trailColor={electronColors[2]} orbitRadius={3} electronOrbitSpeed={electronOrbitSpeed} offsetAngle={THREE.MathUtils.degToRad(240)} />
      <OrbitControls 
        enablePan={false} 
        enableZoom={true} 
        minDistance={3} 
        maxDistance={20} 
        autoRotate 
        autoRotateSpeed={cameraOrbitSpeed}
      />
    </>
  );
};

export default function Component() {
  const backgroundColor = tweaks.backgroundColor.useState();
  
  return (
    <div className="h-full w-full overflow-hidden cursor-grab active:cursor-grabbing" style={{ background: backgroundColor }}>
      <Canvas dpr={budgetDpr()} camera={{ position: [0, 5, 10], fov: 50 }}>
        <FitFov fov={50} minAspect={0.75} />
        <Scene />
      </Canvas>
    </div>
  );
}
