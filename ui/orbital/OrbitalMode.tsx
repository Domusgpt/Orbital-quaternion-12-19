import React, { useEffect, useMemo, useRef, useState } from "react";
import { ProductOrbitVisualizer } from "../../core/ProductOrbitVisualizer";
import { OrbitalInputBridge } from "./OrbitalInputBridge";

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

const OrbitalMode: React.FC<OrbitalModeProps> = ({ ring0Url, ring1Url, productName }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const visualizerRef = useRef<ProductOrbitVisualizer | null>(null);
  const bridgeRef = useRef<OrbitalInputBridge | null>(null);
  const frameRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);

  const assets = useMemo(() => ({ ring0Url, ring1Url }), [ring0Url, ring1Url]);

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
  }, [assets]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="absolute top-6 left-6 z-10 space-y-2">
        <div className="px-4 py-2 rounded-lg bg-black/80 border border-white/10 text-[9px] font-bold uppercase tracking-[0.3em] text-white/70">
          VIB3_ORBITAL
        </div>
        <div className="px-4 py-2 rounded-lg bg-black/60 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-indigo-200">
          {productName}
        </div>
      </div>
      <div className="absolute bottom-6 right-6 z-10 px-4 py-2 rounded-lg bg-black/70 border border-white/10 text-[9px] font-bold uppercase tracking-[0.3em] text-white/70">
        Drag to spin · Vertical drag for pitch
      </div>
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
      />
    </div>
  );
};

export default OrbitalMode;
