import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';

// The Gizmo scenes keep a fixed vertical fov, so on a tall, narrow screen (phone
// portrait) the sphere spills past the sides. Below `minAspect` this widens the
// vertical fov so the horizontal framing stays what it would be at `minAspect`.
// Wider screens (landscape, desktop) keep the original fov untouched.
export default function FitFov({ fov, minAspect }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useLayoutEffect(() => {
    const aspect = size.width / size.height;
    const halfTan = Math.tan(THREE_DEG2RAD * fov / 2);
    camera.fov = aspect < minAspect
      ? (2 * Math.atan(halfTan * minAspect / aspect)) / THREE_DEG2RAD
      : fov;
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, fov, minAspect]);

  return null;
}

const THREE_DEG2RAD = Math.PI / 180;
