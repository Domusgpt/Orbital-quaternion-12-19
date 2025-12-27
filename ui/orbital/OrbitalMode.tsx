import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ProductOrbitVisualizer, DebugInfo, RenderMode } from "../../core/ProductOrbitVisualizer";
import { OrbitalInputBridge } from "./OrbitalInputBridge";
import { ANGULAR_SEQUENCE, QUADRANT_GRID } from "../../core/QuadrantFrameMap";

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

export type OrbitalModeProps = {
  ring0Url: string;
  ring1Url: string;
  productName: string;
};

type TouchLog = {
  time: number;
  type: string;
  x: number;
  y: number;
};

const OrbitalMode: React.FC<OrbitalModeProps> = ({ ring0Url, ring1Url, productName }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const visualizerRef = useRef<ProductOrbitVisualizer | null>(null);
  const bridgeRef = useRef<OrbitalInputBridge | null>(null);
  const frameRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);

  // Debug state
  const [debugMode, setDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [touchLogs, setTouchLogs] = useState<TouchLog[]>([]);
  const [showSpriteSheets, setShowSpriteSheets] = useState(false);

  // Render mode state
  const [renderMode, setRenderMode] = useState<RenderMode>('orbital');

  const assets = useMemo(() => ({ ring0Url, ring1Url }), [ring0Url, ring1Url]);

  // Log touch events
  const logTouch = useCallback((type: string, x: number, y: number) => {
    if (!debugMode) return;
    setTouchLogs(prev => [
      { time: Date.now(), type, x: Math.round(x), y: Math.round(y) },
      ...prev.slice(0, 19) // Keep last 20
    ]);
  }, [debugMode]);

  // Toggle render mode
  const toggleRenderMode = useCallback(() => {
    const newMode: RenderMode = renderMode === 'orbital' ? 'turnstile' : 'orbital';
    setRenderMode(newMode);
    if (visualizerRef.current) {
      visualizerRef.current.setRenderMode(newMode);
    }
  }, [renderMode]);

  useEffect(() => {
    let isMounted = true;

    const setup = async () => {
      const [ring0, ring1] = await Promise.all([
        loadImage(assets.ring0Url),
        loadImage(assets.ring1Url)
      ]);

      if (!isMounted || !canvasRef.current) {
        return;
      }

      const visualizer = new ProductOrbitVisualizer(canvasRef.current, { ring0, ring1 });
      visualizerRef.current = visualizer;

      if (!visualizer.isSupported()) {
        setWebglError("WebGL unavailable: orbital renderer requires hardware acceleration.");
        return;
      }

      const resize = () => {
        if (!canvasRef.current) {
          return;
        }
        const rect = canvasRef.current.getBoundingClientRect();
        const pixelRatio = window.devicePixelRatio || 1;
        visualizer.setSize(rect.width * pixelRatio, rect.height * pixelRatio);
      };

      resize();
      window.addEventListener("resize", resize);

      bridgeRef.current = new OrbitalInputBridge(canvasRef.current, (payload) => {
        visualizer.updateFromRotor(payload.rotation, payload.deltaTime);
      });

      const loop = () => {
        visualizer.render();
        // Update debug info every frame if debug mode is on
        if (debugMode && visualizerRef.current) {
          setDebugInfo(visualizerRef.current.getDebugInfo());
        }
        frameRef.current = requestAnimationFrame(loop);
      };
      frameRef.current = requestAnimationFrame(loop);
      setIsReady(true);

      return () => {
        window.removeEventListener("resize", resize);
      };
    };

    setup();

    return () => {
      isMounted = false;
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      bridgeRef.current?.detach();
      bridgeRef.current = null;
      visualizerRef.current = null;
    };
  }, [assets, debugMode]);

  // Touch event handlers for logging
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    logTouch('START', touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    logTouch('MOVE', touch.clientX, touch.clientY);
  };

  const handleTouchEnd = () => {
    logTouch('END', 0, 0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    logTouch('MOUSE_DOWN', e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.buttons > 0) {
      logTouch('MOUSE_DRAG', e.clientX, e.clientY);
    }
  };

  const handleMouseUp = () => {
    logTouch('MOUSE_UP', 0, 0);
  };

  // Get frame direction label
  const getFrameLabel = (frameIndex: number): string => {
    const frame = QUADRANT_GRID.find(f => f.frameIndex === frameIndex);
    return frame ? `${frame.direction} (${frame.angle}°)` : `Frame ${frameIndex}`;
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Mode & Debug Toggle Buttons */}
      <div className="absolute top-6 right-6 z-20 flex gap-2">
        <button
          onClick={toggleRenderMode}
          className={`px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${
            renderMode === 'orbital'
              ? 'bg-indigo-600 text-white border border-indigo-400'
              : 'bg-amber-600 text-white border border-amber-400'
          }`}
        >
          {renderMode === 'orbital' ? 'ORBITAL_16' : 'TURNSTILE_8'}
        </button>
        <button
          onClick={() => setDebugMode(!debugMode)}
          className={`px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${
            debugMode
              ? 'bg-green-600 text-white border border-green-400'
              : 'bg-black/60 text-white/60 border border-white/10 hover:bg-black/80'
          }`}
        >
          {debugMode ? 'DEBUG_ON' : 'DEBUG'}
        </button>
      </div>

      {/* Labels */}
      <div className="absolute top-6 left-6 z-10 space-y-2">
        <div className="px-4 py-2 rounded-lg bg-black/80 border border-white/10 text-[9px] font-bold uppercase tracking-[0.3em] text-white/70">
          VIB3_ORBITAL
        </div>
        <div className="px-4 py-2 rounded-lg bg-black/60 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-indigo-200">
          {productName}
        </div>
      </div>

      {/* Help text */}
      {!debugMode && (
        <div className="absolute bottom-6 right-6 z-10 px-4 py-2 rounded-lg bg-black/70 border border-white/10 text-[9px] font-bold uppercase tracking-[0.3em] text-white/70">
          {renderMode === 'orbital'
            ? 'Drag to spin · Vertical drag for pitch'
            : 'Drag to spin (single axis)'}
        </div>
      )}

      {/* Debug Panel */}
      {debugMode && debugInfo && (
        <div className="absolute bottom-4 left-4 right-4 z-20 bg-black/95 border border-green-500/50 rounded-xl p-4 max-h-[60vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-3 border-b border-green-500/30 pb-2">
            <span className="text-green-400 text-[10px] font-bold uppercase tracking-widest">Debug Panel</span>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSpriteSheets(!showSpriteSheets)}
                className={`px-2 py-1 rounded text-[8px] font-bold uppercase ${
                  showSpriteSheets ? 'bg-green-600 text-white' : 'bg-white/10 text-white/60'
                }`}
              >
                Sprites
              </button>
              <button
                onClick={() => setTouchLogs([])}
                className="px-2 py-1 rounded bg-red-600/50 text-white text-[8px] font-bold uppercase"
              >
                Clear Logs
              </button>
            </div>
          </div>

          {/* Sprite Sheet Preview */}
          {showSpriteSheets && (
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div>
                <div className="text-[8px] text-green-400 uppercase mb-1">Ring 0 (Pitch 0°)</div>
                <img src={ring0Url} alt="Ring 0" className="w-full rounded border border-green-500/30" />
                <div className="text-[8px] text-white/40 mt-1">{debugInfo.textureSize.ring0}</div>
              </div>
              <div>
                <div className="text-[8px] text-green-400 uppercase mb-1">Ring 1 (Pitch 30°)</div>
                <img src={ring1Url} alt="Ring 1" className="w-full rounded border border-green-500/30" />
                <div className="text-[8px] text-white/40 mt-1">{debugInfo.textureSize.ring1}</div>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <div className="bg-white/5 rounded p-2">
              <div className="text-[8px] text-green-400 uppercase">Direction</div>
              <div className="text-white font-bold text-lg">{debugInfo.compassDirection}</div>
            </div>
            <div className="bg-white/5 rounded p-2">
              <div className="text-[8px] text-green-400 uppercase">Yaw</div>
              <div className="text-white font-mono text-sm">{debugInfo.yawDeg.toFixed(1)}°</div>
            </div>
            <div className="bg-white/5 rounded p-2">
              <div className="text-[8px] text-green-400 uppercase">Pitch</div>
              <div className="text-white font-mono text-sm">{debugInfo.pitch.toFixed(1)}°</div>
            </div>
            <div className="bg-white/5 rounded p-2">
              <div className="text-[8px] text-green-400 uppercase">Velocity</div>
              <div className="text-white font-mono text-sm">{debugInfo.velocity.toFixed(3)}</div>
            </div>
          </div>

          {/* Frame Info */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-indigo-900/30 rounded p-2">
              <div className="text-[8px] text-indigo-400 uppercase">Frame A</div>
              <div className="text-white font-bold">{debugInfo.frameA}</div>
              <div className="text-[8px] text-white/50">{getFrameLabel(debugInfo.frameA)}</div>
            </div>
            <div className="bg-indigo-900/30 rounded p-2">
              <div className="text-[8px] text-indigo-400 uppercase">Frame B</div>
              <div className="text-white font-bold">{debugInfo.frameB}</div>
              <div className="text-[8px] text-white/50">{getFrameLabel(debugInfo.frameB)}</div>
            </div>
            <div className="bg-indigo-900/30 rounded p-2">
              <div className="text-[8px] text-indigo-400 uppercase">Blend</div>
              <div className="text-white font-mono">{(debugInfo.blendFactor * 100).toFixed(0)}%</div>
              <div className="h-1 bg-white/20 rounded mt-1">
                <div className="h-full bg-indigo-500 rounded" style={{ width: `${debugInfo.blendFactor * 100}%` }} />
              </div>
            </div>
          </div>

          {/* System Info */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-white/5 rounded p-2">
              <div className="text-[8px] text-green-400 uppercase">WebGL</div>
              <div className="text-white text-sm">{debugInfo.webglVersion}</div>
            </div>
            <div className={`rounded p-2 ${debugInfo.renderMode === 'orbital' ? 'bg-indigo-900/30' : 'bg-amber-900/30'}`}>
              <div className="text-[8px] text-green-400 uppercase">Render Mode</div>
              <div className={`font-bold text-sm ${debugInfo.renderMode === 'orbital' ? 'text-indigo-300' : 'text-amber-300'}`}>
                {debugInfo.renderMode === 'orbital' ? 'ORBITAL (16)' : 'TURNSTILE (8)'}
              </div>
            </div>
            <div className="bg-white/5 rounded p-2">
              <div className="text-[8px] text-green-400 uppercase">Warp Factor</div>
              <div className="text-white font-mono text-sm">{debugInfo.warpFactor.toFixed(3)}</div>
            </div>
          </div>

          {/* Angular Sequence Reference */}
          <div className="mb-4">
            <div className="text-[8px] text-green-400 uppercase mb-1">Angular Sequence</div>
            <div className="flex flex-wrap gap-1">
              {ANGULAR_SEQUENCE.map((frameIdx, angleIdx) => (
                <div
                  key={angleIdx}
                  className={`px-1.5 py-0.5 rounded text-[8px] font-mono ${
                    debugInfo.frameA === frameIdx || debugInfo.frameB === frameIdx
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white/10 text-white/50'
                  }`}
                >
                  {frameIdx}
                </div>
              ))}
            </div>
          </div>

          {/* Touch Logs */}
          <div>
            <div className="text-[8px] text-green-400 uppercase mb-1">Touch/Input Log</div>
            <div className="bg-black/50 rounded p-2 max-h-24 overflow-y-auto font-mono text-[9px]">
              {touchLogs.length === 0 ? (
                <div className="text-white/30">No input events yet...</div>
              ) : (
                touchLogs.map((log, i) => (
                  <div key={i} className="text-white/70">
                    <span className="text-green-400">{new Date(log.time).toLocaleTimeString()}</span>
                    {' '}
                    <span className={log.type.includes('START') || log.type.includes('DOWN') ? 'text-yellow-400' : log.type.includes('END') || log.type.includes('UP') ? 'text-red-400' : 'text-white/50'}>
                      {log.type}
                    </span>
                    {log.x > 0 && ` (${log.x}, ${log.y})`}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black uppercase tracking-[0.4em] text-white/40">
          Loading Orbital Rings...
        </div>
      )}
      {webglError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white px-6 text-center text-xs font-bold uppercase tracking-[0.3em] rounded-[2.5rem]">
          {webglError}
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="w-full h-full max-w-4xl max-h-[80vh] bg-white rounded-[2.5rem] shadow-2xl border border-white/10"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
    </div>
  );
};

export default OrbitalMode;
