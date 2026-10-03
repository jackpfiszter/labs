import React, { useState, useEffect, useRef, useCallback } from 'react';
import { gizmoRuntime } from '@gizmo/runtime';
import { colord, extend } from 'colord';
import namesPlugin from 'colord/plugins/names';

extend([namesPlugin]);

const tweaks = gizmoRuntime.tweaks({
  cycleSpeed: { type: 'slider', value: 300.0, min: 100, max: 2000, step: 100, name: 'Color Cycle Speed', index: 0 },
  hexCodeSize: { type: 'slider', value: 24, min: 16, max: 48, step: 2, name: 'Hex Code Size', index: 1 },
  colorNameSize: { type: 'slider', value: 16, min: 12, max: 32, step: 1, name: 'Color Name Size', index: 2 },
  topTextColor: { type: 'color', value: '#FFFFFF', name: 'Top Text Color', index: 4 },
  bottomTextColor: { type: 'color', value: '#000000', name: 'Bottom Text Color', index: 5 },
  vibrationIntensity: { type: 'slider', value: 0.3, min: 0.1, max: 1, step: 0.1, name: 'Vibration Intensity', index: 6 },
});

// Generate a random hex color
const getRandomColor = () => {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
};

// Get complementary color
const getComplementaryColor = (hex) => {
  // Remove the # if present
  hex = hex.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Get complementary RGB values (255 - original)
  const compR = (255 - r).toString(16).padStart(2, '0');
  const compG = (255 - g).toString(16).padStart(2, '0');
  const compB = (255 - b).toString(16).padStart(2, '0');
  
  // Return as hex
  return `#${compR}${compG}${compB}`;
};

const getColorName = (hex) => {
  return colord(hex).toName({ closest: true });
};

export default function Component() {
  const [colorHistory, setColorHistory] = useState([{ top: getRandomColor(), bottom: '' }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  const cycleSpeed = tweaks.cycleSpeed.useState();
  const hexCodeSize = tweaks.hexCodeSize.useState();
  const colorNameSize = tweaks.colorNameSize.useState();
  const topTextColor = tweaks.topTextColor.useState();
  const bottomTextColor = tweaks.bottomTextColor.useState();
  const vibrationIntensity = tweaks.vibrationIntensity.useState();
  
  const colorInterval = useRef(null);
  const vibrationInterval = useRef(null);
  const touchStartX = useRef(0);

  const topColor = colorHistory[historyIndex]?.top;
  const bottomColor = topColor ? getComplementaryColor(topColor) : '#000000';

  // Start color cycling
  useEffect(() => {
    if (!isPaused) {
      colorInterval.current = setInterval(() => {
        const newTopColor = getRandomColor();
        setColorHistory(prev => [...prev, { top: newTopColor, bottom: getComplementaryColor(newTopColor) }].slice(-100)); // Keep last 100
      }, cycleSpeed);
      
      // Soft vibration while cycling
      vibrationInterval.current = setInterval(() => {
        gizmoRuntime.performHaptic('soft');
      }, 1000 * vibrationIntensity);
    }
    
    return () => {
      if (colorInterval.current) clearInterval(colorInterval.current);
      if (vibrationInterval.current) clearInterval(vibrationInterval.current);
    };
  }, [isPaused, cycleSpeed, vibrationIntensity]);

  useEffect(() => {
    if (!isPaused) {
      setHistoryIndex(colorHistory.length - 1);
    }
  }, [isPaused, colorHistory.length]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    
    setIsPaused(true);
    gizmoRuntime.performHaptic('medium');
  };

  const handleTouchEnd = () => {
    setIsPaused(false);
    gizmoRuntime.performHaptic('light');
    touchStartX.current = 0;
  };

  const handleTouchMove = useCallback((e) => {
    if (!isPaused || touchStartX.current === 0) return;

    const currentX = e.touches[0].clientX;
    const deltaX = currentX - touchStartX.current;

    if (Math.abs(deltaX) > 30) { // Swipe threshold
      if (deltaX < 0) { // Swipe Left (for previous)
        setHistoryIndex(prev => Math.max(0, prev - 1));
      } else { // Swipe Right (for next/current)
        setHistoryIndex(prev => Math.min(colorHistory.length - 1, prev + 1));
      }
      touchStartX.current = currentX; // Reset start position for next swipe
      gizmoRuntime.performHaptic('soft');
    }
  }, [isPaused, colorHistory.length]);

  return (
    <div 
      className="h-screen w-screen flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      {/* Top half */}
      <div 
        className="w-full h-1/2 flex items-center justify-center relative"
        style={{ backgroundColor: topColor }}
      >
        {isPaused && topColor && (
          <>
            <div 
              className="font-mono text-center"
              style={{ color: topTextColor }}
            >
              <div className="font-bold" style={{ fontSize: `${hexCodeSize}px` }}>
                {topColor.toUpperCase()}
              </div>
              <div style={{ fontSize: `${colorNameSize}px`, textTransform: 'capitalize' }}>
                {getColorName(topColor)}
              </div>
            </div>
            <div className="absolute left-4 text-4xl opacity-50" style={{ color: topTextColor }}>â€¹</div>
            <div className="absolute right-4 text-4xl opacity-50" style={{ color: topTextColor }}>â€º</div>
          </>
        )}
      </div>
      
      {/* Bottom half */}
      <div 
        className="w-full h-1/2 flex items-center justify-center relative"
        style={{ backgroundColor: bottomColor }}
      >
        {isPaused && bottomColor && (
          <>
            <div 
              className="font-mono text-center"
              style={{ color: bottomTextColor }}
            >
              <div className="font-bold" style={{ fontSize: `${hexCodeSize}px` }}>
                {bottomColor.toUpperCase()}
              </div>
              <div style={{ fontSize: `${colorNameSize}px`, textTransform: 'capitalize' }}>
                {getColorName(bottomColor)}
              </div>
            </div>
            <div className="absolute left-4 text-4xl opacity-50" style={{ color: bottomTextColor }}>â€¹</div>
            <div className="absolute right-4 text-4xl opacity-50" style={{ color: bottomTextColor }}>â€º</div>
          </>
        )}
      </div>
    </div>
  );
}