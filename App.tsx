
import React, { useState, useEffect } from 'react';
import ImageUploader from './components/ImageUploader';
import OrbitalMode from './ui/orbital/OrbitalMode';
import { generateOrbitalAssets } from './services/OrbitalGenService';
import { ImageState, BatchItem } from './types';

const KINETIC_LOGS = [
  "INITIALIZING_CORE_V3",
  "PARSING_REFERENCE_TOPOLOGY",
  "MAPPING_LIGHT_VECTORS",
  "ESTABLISHING_ROTATIONAL_LATTICE",
  "SYNTHESIZING_8_FRAME_GRID",
  "VALIDATING_RASTER_DENSITY",
  "DKG_STABILIZED_READY"
];

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [productName, setProductName] = useState("");
  const [images, setImages] = useState<ImageState>({ front: null, back: null });
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [activeGolemId, setActiveGolemId] = useState<string | null>(null);
  const [logIdx, setLogIdx] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Collapsed by default
  const [manualKey, setManualKey] = useState("");
  const [keyError, setKeyError] = useState("");

  const activeGolem = batch.find(item => item.id === activeGolemId) || null;

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedKey = sessionStorage.getItem("GEMINI_API_KEY");
        if (storedKey) {
          setHasKey(true);
          return;
        }
        if (import.meta.env.VITE_GEMINI_API_KEY) {
          setHasKey(true);
          return;
        }
        const isAuthed = await (window as any).aistudio.hasSelectedApiKey();
        setHasKey(isAuthed);
      } catch (e) {
        setHasKey(false);
      }
    };
    checkAuth();
  }, []);

  const resolveApiKey = async () => {
    const storedKey = sessionStorage.getItem("GEMINI_API_KEY");
    if (storedKey) return storedKey;
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (envKey) {
      return envKey as string;
    }
    const aistudio = (window as any).aistudio;
    if (aistudio?.getSelectedApiKey) {
      const selected = aistudio.getSelectedApiKey();
      return typeof selected === 'string' ? selected : await selected;
    }
    return '';
  };

  const handleEstablishAuth = async () => {
    try {
      if (import.meta.env.VITE_GEMINI_API_KEY) {
        setHasKey(true);
        return;
      }
      await (window as any).aistudio.openSelectKey();
      setHasKey(true);
    } catch (e) {
      console.error("Auth sync failed", e);
    }
  };

  const handleManualKeySave = () => {
    if (!manualKey.trim()) {
      setKeyError("API key required");
      return;
    }
    sessionStorage.setItem("GEMINI_API_KEY", manualKey.trim());
    setKeyError("");
    setHasKey(true);
  };

  const handleGenerate = async () => {
    if (!images.front) return;
    
    // Auto-generate name if empty
    const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const finalName = productName.trim() || `SYNTH_GOLEM_${timestamp.replace(/:/g, '')}`;
    
    const id = Math.random().toString(36).substring(7).toUpperCase();
    const newItem: BatchItem = {
      id,
      productName: finalName,
      status: 'SYNTHESIZING',
      progress: 0,
      images: { ...images }
    };

    setBatch(prev => [newItem, ...prev]);
    setActiveGolemId(id);

    const logInterval = setInterval(() => {
      setLogIdx(prev => (prev + 1) % KINETIC_LOGS.length);
    }, 1200);

    try {
      if (!images.back) {
        throw new Error("BACK_REFERENCE_REQUIRED");
      }
      const apiKey = await resolveApiKey();
      const result = await generateOrbitalAssets(
        finalName,
        images.front!,
        images.back,
        apiKey
      );
      setBatch(prev => prev.map(item => 
        item.id === id 
          ? { ...item, status: 'COMPLETE' as const, orbitalAssets: result } 
          : item
      ));
    } catch (err: any) {
      const errorMsg = err.message;
      if (errorMsg.includes("Requested entity was not found") || errorMsg === "AUTH_PROTOCOL_EXPIRED") {
        setBatch(prev => prev.map(item => 
          item.id === id ? { ...item, status: 'FAILED' as const, error: "RE_AUTH_REQUIRED" } : item
        ));
        setHasKey(false);
      } else {
        setBatch(prev => prev.map(item => 
          item.id === id ? { ...item, status: 'FAILED' as const, error: errorMsg } : item
        ));
      }
    } finally {
      clearInterval(logInterval);
      setLogIdx(0);
    }
  };

  if (hasKey === false) {
    return (
      <div className="min-h-screen bg-[#020205] text-white flex flex-col items-center justify-center p-8 font-sans">
        <div className="w-20 h-20 bg-indigo-600 rounded-2xl mb-8 flex items-center justify-center shadow-2xl shadow-indigo-500/40 cursor-pointer active:scale-95 transition-all" onClick={handleEstablishAuth}>
           <div className="w-8 h-8 border-4 border-white rounded-lg rotate-45" />
        </div>
        <h1 className="text-3xl font-black mb-2 tracking-tight uppercase">ENCRYPTED_OS</h1>
        <p className="text-indigo-300/40 text-[10px] font-bold uppercase tracking-[0.4em] mb-12">Session Key Required for Synth Access</p>
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={handleEstablishAuth}
            className="w-full px-10 py-4 bg-white text-black font-black uppercase tracking-widest text-[11px] rounded-xl hover:bg-indigo-50 active:scale-95 transition-all shadow-xl"
          >
            Verify Credentials
          </button>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
            <div className="text-[10px] uppercase font-bold text-white/60 tracking-[0.18em]">Manual key (kept client-side)</div>
            <input
              type="password"
              value={manualKey}
              onChange={(e) => setManualKey(e.target.value)}
              placeholder="Paste GEMINI API Key"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-400"
            />
            {keyError && <div className="text-red-400 text-[10px] font-bold uppercase tracking-[0.18em]">{keyError}</div>}
            <button
              onClick={handleManualKeySave}
              className="w-full px-4 py-2 bg-indigo-500/80 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-lg active:scale-95 transition-all"
            >
              Store Locally
            </button>
            <p className="text-[9px] text-white/40 leading-relaxed">Key is stored in sessionStorage only for this browser session and never baked into the deployed bundle.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#020204] text-white font-sans flex flex-col overflow-hidden">
      {/* High Visibility Header */}
      <header className="h-14 border-b border-white/10 bg-[#0c0c0e] flex items-center justify-between px-5 shrink-0 z-50 shadow-lg">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors group"
            title="Toggle History"
          >
            <svg className={`w-5 h-5 transition-transform duration-300 ${sidebarOpen ? 'rotate-180 text-indigo-400' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,1)]" />
            <span className="font-black text-xs uppercase tracking-[0.2em]">DKG_SYNTH</span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest hidden sm:block">Node_01: Active</span>
          <button onClick={handleEstablishAuth} className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/40 rounded-lg text-[9px] font-bold uppercase tracking-widest text-indigo-200 hover:text-white transition-all">Reset_Sync</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Collapsible Sidebar - High Contrast */}
        <aside className={`${sidebarOpen ? 'w-72' : 'w-0'} border-r border-white/10 bg-[#08080a] flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden`}>
          <div className="p-5 flex flex-col h-full min-w-[18rem]">
            <div className="flex justify-between items-center mb-6">
              <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Buffer_Queue ({batch.length})</span>
              {batch.length > 0 && (
                <button onClick={() => setBatch([])} className="text-[9px] text-red-400 font-bold uppercase hover:text-red-300 transition-colors">Wipe</button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar pr-1">
              {batch.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-20 space-y-2">
                   <div className="w-8 h-8 border border-white/20 rounded-lg" />
                   <span className="text-[8px] font-bold uppercase tracking-widest">No_History</span>
                </div>
              )}
              {batch.map(item => (
                <div 
                  key={item.id}
                  onClick={() => setActiveGolemId(item.id)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer group ${activeGolemId === item.id ? 'bg-indigo-600 border-indigo-400 shadow-xl' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10'}`}
                >
                  <div className="flex justify-between items-center">
                     <span className={`text-[11px] font-bold uppercase truncate pr-3 ${activeGolemId === item.id ? 'text-white' : 'text-white/70'}`}>{item.productName}</span>
                     <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.status === 'COMPLETE' ? 'bg-green-400' : item.status === 'FAILED' ? 'bg-red-500' : 'bg-white animate-pulse'}`} />
                  </div>
                  <div className={`text-[7px] font-bold uppercase tracking-widest mt-1 ${activeGolemId === item.id ? 'text-indigo-200' : 'text-white/10'}`}>REF: {item.id}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Primary Workspace */}
        <main className="flex-1 bg-[#020204] flex flex-col overflow-hidden relative">
          {!activeGolem ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-6 lg:p-10 pb-2 shrink-0">
                <h1 className="text-3xl lg:text-5xl font-black tracking-tight uppercase leading-none text-white">Synthesizer_OS</h1>
                <p className="text-indigo-500 text-[10px] font-bold uppercase tracking-[0.5em] mt-2">Orbital Kinematics Engine v3.4</p>
              </div>

              <div className="flex-1 flex flex-col lg:flex-row p-6 lg:p-10 gap-6 lg:gap-10 overflow-y-auto custom-scrollbar">
                {/* Control Column */}
                <div className="w-full lg:w-80 shrink-0 space-y-6">
                  <div className="bg-[#0e0e10] border border-white/10 rounded-2xl p-5 space-y-6 shadow-2xl">
                    <div className="space-y-2.5">
                      <label className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-1">Entity Identifier</label>
                      <input 
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        placeholder="AUTO_GENERATE..."
                        className="w-full bg-white border-2 border-transparent rounded-xl px-4 py-3.5 text-xs font-bold text-black uppercase tracking-widest outline-none focus:border-indigo-500 transition-all placeholder:text-gray-400 shadow-inner"
                      />
                    </div>

                    <button 
                      onClick={handleGenerate}
                      disabled={!images.front || !images.back}
                      className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-[11px] rounded-xl transition-all disabled:opacity-10 shadow-lg active:scale-95 border-b-4 border-indigo-800"
                    >
                      Process Grid
                    </button>

                    <div className="pt-4 border-t border-white/5">
                       <div className="flex items-center justify-between mb-2">
                         <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Config_Status</span>
                         <span className="text-[8px] font-bold text-green-500 uppercase tracking-widest">Optimized</span>
                       </div>
                       <p className="text-[8px] text-white/20 leading-relaxed uppercase tracking-widest">
                         Mode: Kinetic_Manifold<br/>
                         Rotation: 360_Orbital<br/>
                         Grid: 4x2_Sprite_Map
                       </p>
                    </div>
                  </div>
                  
                   <div className="p-4 bg-indigo-900/10 border border-indigo-500/20 rounded-xl">
                    <p className="text-[9px] text-indigo-300/60 leading-relaxed uppercase tracking-widest italic text-center">
                      * If Name is omitted, a unique timestamp-based identifier will be assigned automatically.
                    </p>
                  </div>
                </div>

                {/* Content Column */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[350px]">
                  <ImageUploader 
                     label="Source_01" 
                     description="FRONTAL_TOPOLOGY" 
                     image={images.front} 
                     onUpload={(img) => setImages(p => ({...p, front: img}))} 
                     onClear={() => setImages(p => ({...p, front: null}))} 
                   />
                   <ImageUploader 
                     label="Source_02" 
                     description="DEPTH_REF_SYNC" 
                     image={images.back} 
                     onUpload={(img) => setImages(p => ({...p, back: img}))} 
                     onClear={() => setImages(p => ({...p, back: null}))} 
                   />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col p-6 lg:p-10 overflow-hidden">
               <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-6 shrink-0">
                  <div className="flex items-center space-x-6">
                    <h2 className="text-2xl lg:text-4xl font-black text-white uppercase tracking-tighter truncate max-w-md">{activeGolem.productName}</h2>
                    <div className="hidden md:flex items-center space-x-2 px-3 py-1 bg-indigo-600 rounded-md">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      <span className="text-white text-[9px] font-bold uppercase tracking-widest">Render_Locked</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveGolemId(null)} 
                    className="px-6 py-3 bg-white hover:bg-gray-100 text-black text-[10px] font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 shadow-xl"
                  >
                    Back_To_OS
                  </button>
               </div>

               <div className="flex-1 flex items-center justify-center min-h-0 relative">
                 {activeGolem.status === 'SYNTHESIZING' ? (
                   <div className="max-w-xs w-full aspect-square bg-white/[0.02] border-2 border-white/5 rounded-3xl flex flex-col items-center justify-center p-8 text-center shadow-2xl">
                      <div className="relative mb-8">
                        <div className="w-16 h-16 border-4 border-indigo-500/10 rounded-full" />
                        <div className="absolute inset-0 w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                      <span className="text-[12px] font-black text-white uppercase tracking-[0.3em] mb-4">{KINETIC_LOGS[logIdx]}</span>
                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                         <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${((logIdx + 1) / KINETIC_LOGS.length) * 100}%` }} />
                      </div>
                   </div>
                 ) : activeGolem.orbitalAssets ? (
                   <div className="w-full h-full max-w-4xl flex items-center justify-center">
                      <OrbitalMode
                        ring0Url={activeGolem.orbitalAssets.sheet0Url}
                        ring1Url={activeGolem.orbitalAssets.sheet1Url}
                        productName={activeGolem.productName}
                      />
                   </div>
                 ) : (
                   <div className="max-w-xs w-full aspect-square bg-red-500/5 border-2 border-red-500/10 rounded-3xl flex flex-col items-center justify-center p-8 text-center">
                      <div className="w-14 h-14 bg-red-600 rounded-xl flex items-center justify-center mb-6 shadow-xl">
                        <span className="text-white text-3xl font-black italic">!</span>
                      </div>
                      <span className="text-red-500 text-[12px] font-black uppercase mb-3 tracking-[0.2em]">Synth_Failed</span>
                      <p className="text-[9px] text-white/30 uppercase tracking-widest leading-relaxed mb-6">{activeGolem.error}</p>
                      <button 
                        onClick={handleGenerate} 
                        className="px-8 py-3 bg-white text-black text-[10px] font-bold uppercase rounded-lg hover:bg-gray-100 transition-all active:scale-95 shadow-xl"
                      >
                        Re-Process
                      </button>
                   </div>
                 )}
               </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
