import React, { useRef, useEffect, useState } from 'react';
import { gizmoRuntime } from '@gizmo/runtime';
import { Upload } from 'lucide-react';

const tweaks = gizmoRuntime.tweaks({
  pixelSize: { index: 0, name: 'Pixel Size', type: 'slider', value: 50.0, min: 2, max: 50, step: 1 },
  distortionStrength: { index: 1, name: 'Distortion Strength', type: 'slider', value: 4.0, min: 1, max: 30, step: 1 },
  glitchSpeed: { index: 2, name: 'Glitch Speed', type: 'slider', value: 0.1, min: 0.1, max: 2, step: 0.1 },
  sortThreshold: { index: 3, name: 'Sort Threshold', type: 'slider', value: 0.3, min: 0, max: 1, step: 0.05 },
  showOriginal: { index: 4, name: 'Show Original', type: 'toggle', value: false },
  backgroundColor: { index: 5, name: 'Background', type: 'color', value: '#000000' },
  glitchColor1: { index: 6, name: 'Glitch Color 1', type: 'color', value: '#E93323' },
  glitchColor2: { index: 7, name: 'Glitch Color 2', type: 'color', value: '#2227F5' },
});

export default function Component() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationRef = useRef<number>();
  const lastFrameTime = useRef<number>(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [gyroData, setGyroData] = useState({ roll: 0, pitch: 0, yaw: 0 });
  const [moshPattern, setMoshPattern] = useState(0);
  
  // Tweaks
  const pixelSize = tweaks.pixelSize.useState();
  const distortionStrength = tweaks.distortionStrength.useState();
  const glitchSpeed = tweaks.glitchSpeed.useState();
  const sortThreshold = tweaks.sortThreshold.useState();
  const showOriginal = tweaks.showOriginal.useState();
  const backgroundColor = tweaks.backgroundColor.useState();
  const glitchColor1 = tweaks.glitchColor1.useState();
  const glitchColor2 = tweaks.glitchColor2.useState();

  // Load the initial image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `${import.meta.env.BASE_URL}assets/mosh.jpg`;
    img.onload = () => {
      originalImageRef.current = img;
      setImageLoaded(true);
    };
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Setup gyroscope listener
  useEffect(() => {
    const removeMotionListener = gizmoRuntime.addMotionListener((event) => {
      setGyroData(event.attitude);
    });
    
    return () => {
      removeMotionListener();
    };
  }, []);

  // Handle file upload
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          originalImageRef.current = img;
          setIsUploading(false);
          gizmoRuntime.performHaptic('medium');
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Trigger file input click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleCanvasTap = () => {
    gizmoRuntime.performHaptic('light');
    setMoshPattern((prev) => (prev + 1) % 3); // Cycle through 3 patterns
  };

  // Reset to original image
  const handleResetClick = () => {
    gizmoRuntime.performHaptic('light');
    setGyroData({ roll: 0, pitch: 0, yaw: 0 }); // Reset gyro for view reset
  };

  // Draw the datamosh effect
  useEffect(() => {
    if (!imageLoaded || !canvasRef.current || !originalImageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match viewport
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Calculate image dimensions to maintain aspect ratio and fill canvas
    const img = originalImageRef.current;
    const imgAspect = img.width / img.height;
    const canvasAspect = canvas.width / canvas.height;
    
    let drawWidth, drawHeight, offsetX, offsetY;
    
    if (imgAspect > canvasAspect) {
      // Image is wider than canvas (relative to their heights)
      drawHeight = canvas.height;
      drawWidth = drawHeight * imgAspect;
      offsetX = (canvas.width - drawWidth) / 2;
      offsetY = 0;
    } else {
      // Image is taller than canvas (relative to their widths)
      drawWidth = canvas.width;
      drawHeight = drawWidth / imgAspect;
      offsetX = 0;
      offsetY = (canvas.height - drawHeight) / 2;
    }

    const animate = (timestamp: number) => {
      if (!ctx || !originalImageRef.current) return;
      
      // Calculate delta time for smooth animation
      const deltaTime = timestamp - lastFrameTime.current;
      lastFrameTime.current = timestamp;
      
      // Clear canvas
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      if (showOriginal) {
        // Draw original image
        ctx.drawImage(originalImageRef.current, offsetX, offsetY, drawWidth, drawHeight);
      } else {
        // Draw datamoshed image
        const rollFactor = gyroData.roll * distortionStrength;
        const pitchFactor = gyroData.pitch * distortionStrength;
        
        // Create a temporary canvas to manipulate pixels
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;
        
        tempCanvas.width = drawWidth;
        tempCanvas.height = drawHeight;
        
        // Draw original image to temp canvas
        tempCtx.drawImage(originalImageRef.current, 0, 0, drawWidth, drawHeight);
        
        // Get image data for manipulation
        const imageData = tempCtx.getImageData(0, 0, drawWidth, drawHeight);
        const data = imageData.data;
        
        // Apply pixel sorting
        pixelSort(imageData, sortThreshold);
        
        // Apply datamosh effect based on gyro data
        for (let y = 0; y < drawHeight; y += pixelSize) {
          for (let x = 0; x < drawWidth; x += pixelSize) {
            // Calculate distortion offset based on gyro data only (removed time-based auto-scrolling)
            let distX, distY;

            switch (moshPattern) {
              case 0: // Original sin/cos pattern
                distX = Math.sin(y * 0.01 + rollFactor) * distortionStrength * 10;
                distY = Math.cos(x * 0.01 + pitchFactor) * distortionStrength * 10;
                break;
              case 1: // Tangent pattern
                distX = Math.tan(y * 0.02 + rollFactor) * distortionStrength * 5;
                distY = Math.tan(x * 0.02 + pitchFactor) * distortionStrength * 5;
                break;
              case 2: // Mixed pattern
                distX = Math.sin(y * 0.015 + rollFactor) * Math.cos(x * 0.015 + pitchFactor) * distortionStrength * 15;
                distY = Math.cos(y * 0.015 + rollFactor) * Math.sin(x * 0.015 + pitchFactor) * distortionStrength * 15;
                break;
              default:
                distX = 0;
                distY = 0;
            }
            
            // Calculate source and destination coordinates
            const srcX = Math.floor(x + distX) % Math.floor(drawWidth);
            const srcY = Math.floor(y + distY) % Math.floor(drawHeight);
            
            // Ensure coordinates are positive
            const positiveSrcX = srcX < 0 ? srcX + Math.floor(drawWidth) : srcX;
            const positiveSrcY = srcY < 0 ? srcY + Math.floor(drawHeight) : srcY;
            
            // Copy pixel block
            for (let py = 0; py < pixelSize && y + py < drawHeight; py++) {
              for (let px = 0; px < pixelSize && x + px < drawWidth; px++) {
                // Source pixel index
                const srcIdx = ((positiveSrcY + py) * Math.floor(drawWidth) + (positiveSrcX + px)) * 4;
                
                // Destination pixel index
                const destIdx = ((y + py) * Math.floor(drawWidth) + (x + px)) * 4;
                
                if (srcIdx >= 0 && srcIdx < data.length - 3 && destIdx >= 0 && destIdx < data.length - 3) {
                  // Copy original pixel without noise or color shifts
                  data[destIdx] = data[srcIdx];
                  data[destIdx + 1] = data[srcIdx + 1];
                  data[destIdx + 2] = data[srcIdx + 2];
                  data[destIdx + 3] = data[srcIdx + 3]; // Alpha
                }
              }
            }
          }
        }
        
        // Put modified image data back to temp canvas
        tempCtx.putImageData(imageData, 0, 0);
        
        // Draw temp canvas to main canvas
        ctx.drawImage(tempCanvas, offsetX, offsetY, drawWidth, drawHeight);
        
        // Removed scan lines and other noise effects
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [imageLoaded, gyroData, pixelSize, distortionStrength, glitchSpeed, showOriginal, backgroundColor, glitchColor1, glitchColor2, sortThreshold, moshPattern]);

  // Helper function to convert hex color to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  // Pixel sorting function
  const pixelSort = (imageData: ImageData, threshold: number) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    const getBrightness = (r: number, g: number, b: number) => (r * 299 + g * 587 + b * 114) / 1000;

    for (let y = 0; y < height; y++) {
      let sortStart = -1;
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const brightness = getBrightness(data[index], data[index + 1], data[index + 2]) / 255;

        if (sortStart === -1 && brightness > threshold) {
          sortStart = x;
        } else if (sortStart !== -1 && brightness < threshold) {
          sortRow(data, y * width * 4 + sortStart * 4, (x - sortStart));
          sortStart = -1;
        }
      }
      if (sortStart !== -1) {
        sortRow(data, y * width * 4 + sortStart * 4, (width - sortStart));
      }
    }
  };

  const sortRow = (rowData: Uint8ClampedArray, startIndex: number, length: number) => {
    const pixels = [];
    for (let i = 0; i < length; i++) {
      const index = startIndex + i * 4;
      pixels.push({
        r: rowData[index],
        g: rowData[index + 1],
        b: rowData[index + 2],
        a: rowData[index + 3],
        brightness: (rowData[index] * 299 + rowData[index + 1] * 587 + rowData[index + 2] * 114) / 1000,
      });
    }

    pixels.sort((a, b) => a.brightness - b.brightness);

    for (let i = 0; i < length; i++) {
      const index = startIndex + i * 4;
      rowData[index] = pixels[i].r;
      rowData[index + 1] = pixels[i].g;
      rowData[index + 2] = pixels[i].b;
      rowData[index + 3] = pixels[i].a;
    }
  };

  return (
    <>
      <div aria-hidden className="fixed inset-0 -z-10" style={{ background: backgroundColor }} />
      
      <canvas 
        ref={canvasRef} 
        className="w-screen h-screen touch-none"
        onClick={handleCanvasTap}
      />
      
      <div className="fixed bottom-0 left-0 p-4">
        <button
          onClick={handleUploadClick}
          className="bg-white text-black w-16 h-16 flex items-center justify-center active:scale-95 transition-transform"
        >
          <Upload size={32} />
        </button>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {isUploading && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-10">
          <div className="text-white text-2xl">Uploading...</div>
        </div>
      )}
      
    </>
  );
}