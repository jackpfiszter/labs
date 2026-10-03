import React, { useRef, useEffect, useState, useCallback } from 'react';
import { gizmoRuntime } from '@gizmo/runtime';
import { Upload } from 'lucide-react';

const tweaks = gizmoRuntime.tweaks({
  pixelSize: { type: 'slider', value: 4.0, min: 4, max: 20, step: 2, name: 'Pixel Size', index: 0 },
  cycleSpeed: { type: 'slider', value: 0.5, min: 0.5, max: 8, step: 0.5, name: 'Cycle Speed', index: 1 },
  backgroundColor: { type: 'color', value: '#000000', name: 'Background', index: 2 },
  enableSound: { type: 'toggle', value: false, name: 'Enable Sound', index: 3 },
});

const PALETTES = [
  ['#ff006e', '#8338ec', '#3a86ff', '#06ffa5', '#ffbe0b', '#fb5607'], // vaporwave
  ['#e63946', '#f77f00', '#fcbf49', '#06d6a0', '#118ab2', '#073b4c'], // retro
  ['#000000', '#404040', '#808080', '#c0c0c0', '#ffffff'], // grayscale
  ['#d7263d', '#f46036', '#2e294e', '#1b998b', '#c5d86d'], // vibrant
  ['#011627', '#fdfffc', '#2ec4b6', '#e71d36', '#ff9f1c'], // contrast
];

// Helper function to interpolate between two hex colors
const lerpColor = (a: string, b: string, amount: number): string => {
  const ar = parseInt(a.slice(1, 3), 16),
        ag = parseInt(a.slice(3, 5), 16),
        ab = parseInt(a.slice(5, 7), 16),
        br = parseInt(b.slice(1, 3), 16),
        bg = parseInt(b.slice(3, 5), 16),
        bb = parseInt(b.slice(5, 7), 16),
        rr = Math.round(ar + (br - ar) * amount),
        rg = Math.round(ag + (bg - ag) * amount),
        rb = Math.round(ab + (bb - ab) * amount);

  return `#${((1 << 24) + (rr << 16) + (rg << 8) + rb).toString(16).slice(1)}`;
};

export default function Component() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(`${import.meta.env.BASE_URL}assets/colour-cycling.jpg`);
  const [colorOffset, setColorOffset] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  
  const pixelSize = tweaks.pixelSize.useState();
  const cycleSpeed = tweaks.cycleSpeed.useState();
  const backgroundColor = tweaks.backgroundColor.useState();
  const enableSound = tweaks.enableSound.useState();

  const currentPalette = PALETTES[paletteIndex];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const pixelateImage = useCallback((source: HTMLImageElement | HTMLCanvasElement, palette: string[]) => {
    const canvas = canvasRef.current;
    const sourceCanvas = sourceCanvasRef.current;
    if (!canvas || !sourceCanvas) return;

    const ctx = canvas.getContext('2d');
    const sourceCtx = sourceCanvas.getContext('2d');
    if (!ctx || !sourceCtx) return;

    const { width: screenWidth, height: screenHeight } = canvas.getBoundingClientRect();
    if (!screenWidth || !screenHeight) return;
    // Backing store at devicePixelRatio (capped) so the pixel blocks stay crisp
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(screenWidth * dpr);
    const targetH = Math.round(screenHeight * dpr);
    if (canvas.width !== targetW) canvas.width = targetW;
    if (canvas.height !== targetH) canvas.height = targetH;

    // Calculate dimensions to cover the entire canvas
    const imgAspectRatio = source.width / source.height;
    const canvasAspectRatio = screenWidth / screenHeight;

    let drawWidth, drawHeight, drawX, drawY;

    if (imgAspectRatio > canvasAspectRatio) {
      // Image is wider than canvas aspect ratio, fit height and crop width
      drawHeight = screenHeight;
      drawWidth = screenHeight * imgAspectRatio;
      drawX = (screenWidth - drawWidth) / 2;
      drawY = 0;
    } else {
      // Image is taller than canvas aspect ratio, fit width and crop height
      drawWidth = screenWidth;
      drawHeight = screenWidth / imgAspectRatio;
      drawX = 0;
      drawY = (screenHeight - drawHeight) / 2;
    }

    // Set source canvas to cover the entire window
    sourceCanvas.width = screenWidth;
    sourceCanvas.height = screenHeight;

    // Clear and draw source image to cover the source canvas
    sourceCtx.clearRect(0, 0, screenWidth, screenHeight);
    if (source instanceof HTMLImageElement) {
      sourceCtx.drawImage(source, drawX, drawY, drawWidth, drawHeight);
    } else {
      sourceCtx.drawImage(source, drawX, drawY, drawWidth, drawHeight);
    }

    // Pixelate from the sourceCanvas
    const pixelatedWidth = Math.floor(screenWidth / pixelSize);
    const pixelatedHeight = Math.floor(screenHeight / pixelSize);
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCanvas.width = pixelatedWidth;
    tempCanvas.height = pixelatedHeight;
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.drawImage(sourceCanvas, 0, 0, pixelatedWidth, pixelatedHeight);

    // Get pixel data and apply palette
    const imageData = tempCtx.getImageData(0, 0, pixelatedWidth, pixelatedHeight);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 128) { // If not transparent
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const paletteIndex = (brightness / 255) * (palette.length -1);
        
        const offsetPaletteIndex = (paletteIndex + colorOffset) % (palette.length);
        const colorIndex1 = Math.floor(offsetPaletteIndex);
        const colorIndex2 = (colorIndex1 + 1) % palette.length;
        const blend = offsetPaletteIndex - colorIndex1;

        const color = lerpColor(palette[colorIndex1], palette[colorIndex2], blend);
        
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
      }
    }

    tempCtx.putImageData(imageData, 0, 0);

    // Draw final result
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height); // Draw tempCanvas to fill the main canvas
  }, [pixelSize, colorOffset]);

  // Load the image once per selection (not every frame)
  useEffect(() => {
    if (!selectedImage) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { if (!cancelled) setLoadedImage(img); };
    img.src = selectedImage;
    return () => { cancelled = true; };
  }, [selectedImage]);

  // Follow the container size (resize / orientation change / iframe)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const { width, height } = canvas.getBoundingClientRect();
      setCanvasSize({ width, height });
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (loadedImage) pixelateImage(loadedImage, currentPalette);
  }, [loadedImage, pixelateImage, currentPalette, canvasSize]);

  useEffect(() => {
    const animate = () => {
      setColorOffset(prev => prev + cycleSpeed * 0.1);
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => animationRef.current && cancelAnimationFrame(animationRef.current);
  }, [cycleSpeed]);

  const handleTap = useCallback(() => {
    setPaletteIndex((prevIndex) => (prevIndex + 1) % PALETTES.length);
    if (enableSound) {
      gizmoRuntime.performHaptic('light');
    }
  }, [enableSound]);

  // Keyboard: Space / Enter cycles the palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'BUTTON' || target.tagName === 'INPUT')) return;
      if ((e.code === 'Space' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleTap]);

  return (
    <>
      <div aria-hidden className="fixed inset-0 -z-10" style={{ background: backgroundColor }} />
      <div className="relative h-screen w-screen flex items-center justify-center cursor-pointer" onClick={handleTap}>
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ imageRendering: 'pixelated', objectFit: 'contain' }}
        />
        <canvas ref={sourceCanvasRef} className="hidden" />

        <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="w-16 h-16 rounded-lg flex items-center justify-center
                       bg-white text-black shadow-lg touch-manipulation cursor-pointer
                       transition-transform [@media(hover:hover)]:hover:scale-105 active:scale-95"
            aria-label="Upload image"
          >
            {isUploading ? '...' : <Upload size={24} />}
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>
    </>
  );
}