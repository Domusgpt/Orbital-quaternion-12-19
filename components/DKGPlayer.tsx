import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ANGULAR_SEQUENCE,
  ANGULAR_LABELS,
  getBlendFrames,
  getCompassDirection,
  frameToGridPosition,
  GRID_COLS,
  GRID_ROWS
} from '../core/QuadrantFrameMap';

interface DKGPlayerProps {
  imageUrl: string;
  productName: string;
}

const DKGPlayer: React.FC<DKGPlayerProps> = ({ imageUrl, productName }) => {
  const [angle, setAngle] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [showGuide, setShowGuide] = useState(false);
  const velocityRef = useRef(0);
  const isDraggingRef = useRef(false);
  const lastMouseXRef = useRef(0);
  const requestRef = useRef<number>(0);

  const update = useCallback(() => {
    if (!isDraggingRef.current) {
      velocityRef.current *= 0.96;
      if (Math.abs(velocityRef.current) < 0.005) velocityRef.current = 0;
      setAngle(prev => (prev + velocityRef.current + 360) % 360);
    }
    requestRef.current = requestAnimationFrame(update);
  }, []);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [update]);

  const onStart = (clientX: number) => {
    isDraggingRef.current = true;
    lastMouseXRef.current = clientX;
    velocityRef.current = 0;
  };

  const onMove = (clientX: number) => {
    if (!isDraggingRef.current) return;
    const delta = clientX - lastMouseXRef.current;
    lastMouseXRef.current = clientX;
    const sensitivity = 0.55;
    velocityRef.current = delta * sensitivity;
    setAngle(prev => (prev + delta * sensitivity + 360) % 360);
  };

  const onEnd = () => { isDraggingRef.current = false; };

  /**
   * Calculate interpolation between quadrant frames using angular sequence lookup.
   * The frames are NOT in sequential order in the grid, so we use ANGULAR_SEQUENCE
   * to find the correct frame indices for blending.
   */
  const calculateQuadrantInterpolation = (currentAngle: number) => {
    const { frameA, frameB, blend } = getBlendFrames(currentAngle);

    // Convert frame indices to grid positions for CSS background-position
    const getGridPosition = (frameIndex: number) => {
      const { col, row } = frameToGridPosition(frameIndex);
      return {
        // Each cell is 1/4 of the grid (25%)
        // For a 4x4 grid, positions are at 0%, 33.33%, 66.67%, 100%
        x: (col / (GRID_COLS - 1)) * 100,
        y: (row / (GRID_ROWS - 1)) * 100
      };
    };

    return {
      p1: getGridPosition(frameA),
      p2: getGridPosition(frameB),
      progress: blend
    };
  };

  const { p1, p2, progress } = calculateQuadrantInterpolation(angle);
  const currentVel = Math.abs(velocityRef.current);
  const compassDir = getCompassDirection(angle);

  return (
    <div className="flex flex-col items-center space-y-8 w-full select-none font-sans group max-w-2xl">
      <div
        className="relative w-full aspect-square bg-[#121214] rounded-[3rem] overflow-hidden border-2 border-white/10 shadow-2xl cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => onStart(e.clientX)}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onTouchStart={(e) => onStart(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={onEnd}
      >
        {/* Render Layer 1 - Frame A */}
        <div
          className="absolute inset-0 bg-no-repeat pointer-events-none"
          style={{
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: '400% 400%', // 4x4 grid
            backgroundPosition: `${p1.x}% ${p1.y}%`,
            transform: `scale(${zoom})`,
            opacity: 1 - progress,
            zIndex: 1
          }}
        />

        {/* Render Layer 2 - Frame B */}
        <div
          className="absolute inset-0 bg-no-repeat pointer-events-none"
          style={{
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: '400% 400%', // 4x4 grid
            backgroundPosition: `${p2.x}% ${p2.y}%`,
            transform: `scale(${zoom})`,
            opacity: progress,
            zIndex: 2
          }}
        />

        {showGuide && (
          <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center opacity-40">
            <div className="absolute w-full h-px bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,1)]" />
            <div className="absolute h-full w-px bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,1)]" />
            <div className="w-[60%] h-[60%] border-2 border-indigo-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.5)]" />
          </div>
        )}

        {/* HUD Controls */}
        <div className="absolute top-6 left-6 flex flex-col space-y-3 z-30">
          <button
            onClick={(e) => { e.stopPropagation(); setShowGuide(!showGuide); }}
            className={`px-4 py-2 rounded-lg border text-[9px] font-bold tracking-widest transition-all shadow-xl ${showGuide ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-black/80 border-white/10 text-white/60'}`}
          >
            HUD_{showGuide ? 'ON' : 'OFF'}
          </button>
          <div className="flex items-center space-x-3 bg-black/90 px-4 py-2 rounded-lg border border-white/10 backdrop-blur-md shadow-xl">
            <div className={`w-2 h-2 rounded-full ${currentVel > 0.05 ? 'bg-indigo-500 animate-pulse' : 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,1)]'}`} />
            <span className="text-[9px] text-white font-bold tracking-widest uppercase">Orbital_Sync</span>
          </div>
        </div>

        <div className="absolute top-6 right-6 z-30">
          <div className="flex flex-col bg-black/80 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl">
            {[1, 1.5, 2].map(z => (
              <button
                key={z}
                onClick={(e) => { e.stopPropagation(); setZoom(z); }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${zoom === z ? 'bg-indigo-600 text-white shadow-xl' : 'text-white/40 hover:text-white'}`}
              >
                <span className="text-[10px] font-black">{z}x</span>
              </button>
            ))}
          </div>
        </div>

        {/* Compass Direction Display */}
        <div className="absolute bottom-8 right-8 z-30 pointer-events-none">
          <div className="text-right">
            <div className="text-[12px] font-bold text-indigo-400/80 tracking-[0.3em] mb-1">
              {compassDir}
            </div>
            <div className="text-[40px] font-black text-white/10 tabular-nums leading-none tracking-tighter">
              {Math.round(angle).toString().padStart(3, '0')}°
            </div>
          </div>
        </div>
      </div>

      {/* Scrubber with 16-point compass markers */}
      <div className="w-full px-2">
        <div className="flex justify-between text-[8px] text-white/20 font-bold uppercase mb-4 tracking-[0.2em]">
          {/* Show key compass points: N, E, S, W, N */}
          <span>N</span>
          <span>NE</span>
          <span>E</span>
          <span>SE</span>
          <span>S</span>
          <span>SW</span>
          <span>W</span>
          <span>NW</span>
          <span>N</span>
        </div>
        <div className="relative h-2 bg-white/5 rounded-full overflow-hidden border border-white/10 shadow-inner">
          {/* Cardinal markers */}
          {[0, 90, 180, 270].map(deg => (
            <div
              key={deg}
              className="absolute top-0 bottom-0 w-px bg-white/20"
              style={{ left: `${(deg / 360) * 100}%` }}
            />
          ))}
          {/* Current position */}
          <div
            className="absolute top-0 bottom-0 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,1)] transition-all duration-100"
            style={{ left: 0, width: `${(angle/360)*100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default DKGPlayer;
