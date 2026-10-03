// A large phone draws about 2.5M pixels at 2x. Desktop windows are several times
// bigger, so at full devicePixelRatio the shaders there do 5-10x the work and stutter.
// Lower the ratio until the canvas fits the same budget, but never below 1x.
const PIXEL_BUDGET = 2_500_000;

export function budgetDpr(width = window.innerWidth, height = window.innerHeight) {
  const native = Math.min(window.devicePixelRatio || 1, 2);
  const fit = Math.sqrt(PIXEL_BUDGET / Math.max(1, width * height));
  return Math.min(native, Math.max(1, fit));
}
