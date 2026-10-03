// Stand-in for Gizmo's `@gizmo/runtime`, which only exists inside the Gizmo app.
// Tweaks resolve to their default values, haptics use the Vibration API, and
// motion comes from the browser's deviceorientation events.
export const gizmoRuntime = {
  tweaks(defs) {
    return Object.fromEntries(
      Object.entries(defs).map(([key, def]) => [key, { value: def.value, useState: () => def.value }])
    );
  },

  performHaptic(style = 'light') {
    const ms = { soft: 5, light: 10, medium: 20, heavy: 35 }[style] ?? 10;
    if (navigator.userActivation?.hasBeenActive === false) return;
    navigator.vibrate?.(ms);
  },

  // Calls `callback` with { attitude: { roll, pitch, yaw } } in radians, like Gizmo.
  // iOS only grants orientation access after a tap, so permission is requested on the first one.
  addMotionListener(callback) {
    const rad = (deg) => ((deg ?? 0) * Math.PI) / 180;
    const onOrientation = (e) =>
      callback({ attitude: { roll: rad(e.gamma), pitch: rad(e.beta), yaw: rad(e.alpha) } });
    const requestPermission = () => DeviceOrientationEvent.requestPermission?.().catch(() => {});

    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('pointerdown', requestPermission, { once: true });
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('pointerdown', requestPermission);
    };
  },
};
