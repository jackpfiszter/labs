import React, { useRef, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { gizmoRuntime } from '@gizmo/runtime';
import { TextureLoader } from 'three';

const tweaks = gizmoRuntime.tweaks({
  displacement: { type: 'slider', value: 1.66, min: 0, max: 2, step: 0.01, name: 'Grass Height', index: 0 },
  noiseScale: { type: 'slider', value: 12.5, min: 1, max: 100, step: 0.1, name: 'Grass Density', index: 1 },
  noiseSpeed: { type: 'slider', value: 2.0, min: 0, max: 2, step: 0.05, name: 'Wind Speed', index: 2 },
  backgroundColor: { type: 'color', value: "#A5DAFF", name: 'Sky Color', index: 3 },
  primaryColor: { type: 'color', value: "#94FF82", name: 'Grass Color', index: 4 },
  secondaryColor: { type: 'color', value: "#142A00", name: 'Grass Shadow', index: 5 },
  cameraHeight: { type: 'slider', value: 15.900001, min: 0.1, max: 20, step: 0.1, name: 'Camera Height', index: 6 },
  backgroundInnerColor: { type: 'color', value: "#FFFFFF", name: 'Background Inner Color', index: 7 },
  backgroundOuterColor: { type: 'color', value: "#005499", name: 'Background Outer Color', index: 8 },
  butterflyCount: { type: 'slider', value: 21.0, min: 0, max: 50, step: 1, name: 'Butterfly Count', index: 9 },
  butterflySpeed: { type: 'slider', value: 2.0, min: 0.1, max: 2, step: 0.1, name: 'Butterfly Speed', index: 10 },
  butterflySize: { type: 'slider', value: 0.6, min: 0.05, max: 2.0, step: 0.01, name: 'Butterfly Size', index: 11 },
  butterflyHeight: { type: 'slider', value: 1.4000001, min: 0.1, max: 5.0, step: 0.1, name: 'Butterfly Height', index: 12 },
  butterflySpread: { type: 'slider', value: 4.3, min: 0.1, max: 5.0, step: 0.1, name: 'Butterfly Spread', index: 13 },
  flutterSpeed: { type: 'slider', value: 27.0, min: 1.0, max: 50.0, step: 1.0, name: 'Flutter Speed', index: 14 },
});

// Advanced vertex shader with displacement
const vertexShader = `
  uniform float time;
  uniform float displacement;
  uniform float noiseScale;
  
  // Classic Perlin 3D Noise by Stefan Gustavson
  vec4 permute(vec4 x) {
    return mod(((x*34.0)+1.0)*x, 289.0);
  }
  
  vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
  }
  
  vec3 fade(vec3 t) {
    return t*t*t*(t*(t*6.0-15.0)+10.0);
  }
  
  float cnoise(vec3 P) {
    vec3 Pi0 = floor(P);
    vec3 Pi1 = Pi0 + vec3(1.0);
    Pi0 = mod(Pi0, 289.0);
    Pi1 = mod(Pi1, 289.0);
    vec3 Pf0 = fract(P);
    vec3 Pf1 = Pf0 - vec3(1.0);
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
  
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying float vNoise;
  
  void main() {
    vUv = uv;
    vNormal = normal;
    
    // Create high-frequency noise for a grass-like texture
    float noise = cnoise(vec3(position * noiseScale));
    // Sharpen the noise to create more defined "blades"
    noise = pow(abs(noise), 1.5);
    vNoise = noise;
    
    // Create a separate, slower noise for the wind sway
    float windSwayX = cnoise(vec3(position.y * 0.5, position.z * 0.5, time * 0.2)) * 0.5;
    float windSwayZ = cnoise(vec3(position.x * 0.5, position.y * 0.5, time * 0.2 + 10.0)) * 0.5;

    // The displacement is applied along the normal
    vec3 displacedPosition = position + normal * displacement * noise;

    // The wind sway is applied perpendicular to the normal, more strongly at the peaks
    // We use cross products to find tangent vectors
    vec3 tangent = normalize(cross(normal, vec3(0.0, 1.0, 0.0)));
    vec3 bitangent = normalize(cross(normal, tangent));

    // Apply wind sway based on the height of the displacement (noise)
    displacedPosition += tangent * windSwayX * noise * displacement;
    displacedPosition += bitangent * windSwayZ * noise * displacement;

    vPosition = displacedPosition;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
  }
`;

// Advanced fragment shader with multiple effects
const fragmentShader = `
  uniform float time;
  uniform vec3 primaryColor;
  uniform vec3 secondaryColor;
  
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying float vNoise;
  
  void main() {
    // Normalized view direction
    vec3 viewDirection = normalize(-vPosition);
    
    // Create dynamic color pattern based on noise
    vec3 color1 = primaryColor; // Bright green
    vec3 color2 = secondaryColor; // Dark green
    
    // Mix colors based on noise value to simulate grass texture
    float colorMix = smoothstep(0.0, 1.0, vNoise);
    vec3 baseColor = mix(color2, color1, colorMix);

    vec3 finalColor = baseColor; // Start with base color
    
    // Add subtle specular highlight
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    vec3 halfVector = normalize(lightDir + viewDirection);
    float specular = pow(max(dot(normalize(vNormal), halfVector), 0.0), 64.0);
    finalColor += vec3(specular * 0.4);
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// Butterfly component
const Butterfly = ({ initialPosition, textureUrl, orbitSpeed, flutterSpeed, sphereRadius, butterflySize, butterflyHeight, butterflySpread }) => {
  const groupRef = useRef();
  const leftWingGroupRef = useRef(); // Ref for the group that will rotate
  const rightWingGroupRef = useRef(); // Ref for the group that will rotate
  const { clock } = useThree();

  const texture = useLoader(TextureLoader, textureUrl);

  // Prepare textures for half-images
  const leftWingTexture = useMemo(() => {
    const newTexture = texture.clone();
    newTexture.repeat.set(0.5, 1); // Use left half of the image
    newTexture.offset.set(0, 0);
    newTexture.needsUpdate = true;
    return newTexture;
  }, [texture]);

  const rightWingTexture = useMemo(() => {
    const newTexture = texture.clone();
    newTexture.repeat.set(0.5, 1); // Use right half of the image
    newTexture.offset.set(0.5, 0);
    newTexture.needsUpdate = true;
    return newTexture;
  }, [texture]);

  const wingWidth = butterflySize / 2; // Each wing is half the total butterfly size
  const wingHeight = wingWidth * 1.5; // Maintain aspect ratio (assuming original image aspect ratio is 1.5 for full butterfly)

  const randomOffset = useMemo(() => new THREE.Vector3(
    (Math.random() - 0.5) * butterflySpread * 5,
    (Math.random() - 0.5) * butterflySpread * 5,
    (Math.random() - 0.5) * butterflySpread * 5
  ), [butterflySpread]);

  useFrame(() => {
    const time = clock.getElapsedTime() * orbitSpeed;

    const angleX = time * 0.5 + randomOffset.x;
    const angleY = time * 0.7 + randomOffset.y;
    const angleZ = time * 0.6 + randomOffset.z;

    const radius = sphereRadius + butterflyHeight + Math.sin(time * 0.3) * 0.5;
    const x = radius * Math.sin(angleX) * Math.cos(angleY);
    const y = radius * Math.sin(angleX) * Math.sin(angleY);
    const z = radius * Math.cos(angleX);

    groupRef.current.position.set(x, y, z);

    groupRef.current.lookAt(new THREE.Vector3(0, 0, 0));
    groupRef.current.rotation.y += Math.PI;

    // Wing flapping animation
    const wingAngle = Math.sin(clock.getElapsedTime() * flutterSpeed) * Math.PI * 0.3; // Half-fold
    if (leftWingGroupRef.current && rightWingGroupRef.current) {
      leftWingGroupRef.current.rotation.y = wingAngle;
      rightWingGroupRef.current.rotation.y = -wingAngle;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Left Wing Group (for pivot) */}
      <group ref={leftWingGroupRef} position={[0, 0, 0]}> {/* This group pivots around the butterfly's center */}
        <mesh position={[-wingWidth / 2, 0, 0]}> {/* Mesh positioned relative to its group's pivot */}
          <planeGeometry args={[wingWidth, wingHeight]} />
          <meshBasicMaterial map={leftWingTexture} side={THREE.DoubleSide} transparent />
        </mesh>
      </group>
      {/* Right Wing Group (for pivot) */}
      <group ref={rightWingGroupRef} position={[0, 0, 0]}> {/* This group pivots around the butterfly's center */}
        <mesh position={[wingWidth / 2, 0, 0]}> {/* Mesh positioned relative to its group's pivot */}
          <planeGeometry args={[wingWidth, wingHeight]} />
          <meshBasicMaterial map={rightWingTexture} side={THREE.DoubleSide} transparent />
        </mesh>
      </group>
    </group>
  );
};

// Helper function to convert hex color to THREE.Vector3
const hexToRgbVector = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? new THREE.Vector3(
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  ) : new THREE.Vector3(1, 1, 1);
};

// Sphere component with custom shader
const ShaderSphere = ({ displacement, noiseScale, noiseSpeed, primaryColor, secondaryColor, currentWindSpeed }) => {
  const meshRef = useRef<THREE.Mesh>();
  const { clock } = useThree();

  const primaryColorVec = useMemo(() => hexToRgbVector(primaryColor), [primaryColor]);
  const secondaryColorVec = useMemo(() => hexToRgbVector(secondaryColor), [secondaryColor]);

  // Create custom shader material
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        time: { value: 0 },
        displacement: { value: displacement },
        noiseScale: { value: noiseScale },
        primaryColor: { value: primaryColorVec },
        secondaryColor: { value: secondaryColorVec }
      }
    });
  }, [displacement, noiseScale, primaryColorVec, secondaryColorVec]);

  // Update shader uniforms on each frame
  useFrame(() => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.time.value = clock.getElapsedTime() * currentWindSpeed; // Use currentWindSpeed
      material.uniforms.displacement.value = displacement;
      material.uniforms.noiseScale.value = noiseScale;
      material.uniforms.primaryColor.value = primaryColorVec;
      material.uniforms.secondaryColor.value = secondaryColorVec;
    }
  });

  return (
    <mesh ref={meshRef} material={shaderMaterial}>
      <icosahedronGeometry args={[10, 256]} />
    </mesh>
  );
};

// This new component contains all the 3D scene elements and hooks.
// It will be rendered inside the Canvas.
const SceneContent = () => {
  const displacement = tweaks.displacement.useState();
  const noiseScale = tweaks.noiseScale.useState();
  const noiseSpeed = tweaks.noiseSpeed.useState(); // Use noiseSpeed directly
  const primaryColor = tweaks.primaryColor.useState();
  const secondaryColor = tweaks.secondaryColor.useState();
  const cameraHeight = tweaks.cameraHeight.useState();
  const butterflyCount = tweaks.butterflyCount.useState();
  const butterflySpeed = tweaks.butterflySpeed.useState();
  const butterflySize = tweaks.butterflySize.useState();
  const butterflyHeight = tweaks.butterflyHeight.useState();
  const butterflySpread = tweaks.butterflySpread.useState();
  const flutterSpeedTweak = tweaks.flutterSpeed.useState(); // Renamed to avoid conflict

  const { camera } = useThree();
  const sphereRadius = 10; // From icosahedronGeometry args

  const butterflyTextures = useMemo(() => [
    `${import.meta.env.BASE_URL}assets/spheres/blue.png`, // Blue butterfly
    `${import.meta.env.BASE_URL}assets/spheres/orange.png`, // Orange butterfly
    `${import.meta.env.BASE_URL}assets/spheres/yellow.png`, // Yellow butterfly
  ], []);

  const butterflies = useMemo(() => {
    const b = [];
    for (let i = 0; i < butterflyCount; i++) {
      b.push({
        initialPosition: new THREE.Vector3(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20 * butterflySpread,
          (Math.random() - 0.5) * 20 * butterflySpread,
          (Math.random() - 0.5) * 20 * butterflySpread
        ),
        textureUrl: butterflyTextures[Math.floor(Math.random() * butterflyTextures.length)],
        orbitSpeed: (0.05 + Math.random() * 0.05) * butterflySpeed,
        flutterSpeed: flutterSpeedTweak + Math.random() * 5,
      });
    }
    return b;
  }, [butterflyCount, butterflyTextures, butterflySpeed, butterflySpread, flutterSpeedTweak]);

  useEffect(() => {
    // Set initial camera position to the side of the sphere, at the equator
    // at a height relative to the sphere's radius.
    camera.position.set(sphereRadius + cameraHeight, 0, 0);
    // Look directly at the center of the sphere
    camera.lookAt(0, 0, 0);
  }, [camera, sphereRadius, cameraHeight]);

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <ShaderSphere
        displacement={displacement}
        noiseScale={noiseScale}
        noiseSpeed={noiseSpeed} // Pass noiseSpeed directly
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        currentWindSpeed={noiseSpeed} // Use noiseSpeed directly
      />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        rotateSpeed={0.5}
        dampingFactor={0.1}
        enableDamping={true}
        target={[0, 0, 0]} // Always target the center of the sphere
      />
      <Suspense fallback={null}>
        {butterflies.map((b, i) => (
          <Butterfly
            key={i}
            initialPosition={b.initialPosition}
            textureUrl={b.textureUrl}
            orbitSpeed={b.orbitSpeed}
            flutterSpeed={b.flutterSpeed}
            sphereRadius={sphereRadius}
            butterflySize={butterflySize}
            butterflyHeight={butterflyHeight}
            butterflySpread={butterflySpread}
          />
        ))}
      </Suspense>
    </>
  );
};

// Scene component now only sets up the Canvas and renders SceneContent inside it.
const Scene = () => {


  return (
    <Canvas>
      <SceneContent />
    </Canvas>
  );
};

export default function Component() {
  const backgroundInnerColor = tweaks.backgroundInnerColor.useState();
  const backgroundOuterColor = tweaks.backgroundOuterColor.useState();
  
  return (
    <>
      <div 
        aria-hidden 
        className="fixed inset-0 -z-10" 
        style={{ 
          background: `radial-gradient(circle, ${backgroundInnerColor} 0%, ${backgroundOuterColor} 100%)` 
        }} 
      />
      <div className="h-screen w-screen">
        <Scene />
      </div>
    </>
  );
}