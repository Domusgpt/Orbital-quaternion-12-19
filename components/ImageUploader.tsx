
import React, { useRef } from 'react';

interface ImageUploaderProps {
  label: string;
  description: string;
  image: string | null;
  onUpload: (base64: string) => void;
  onClear: () => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ label, description, image, onUpload, onClear }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpload(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col space-y-3 h-full min-h-[250px] group">
      <div className="flex justify-between items-center px-1">
        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{label}</span>
        <div className="w-1 h-1 bg-white/20 rounded-full" />
      </div>
      
      <div className={`relative flex-1 rounded-2xl overflow-hidden border-2 transition-all duration-300 ${image ? 'border-indigo-500/50 bg-[#111113] shadow-xl' : 'border-white/5 bg-[#08080a] hover:border-white/10'}`}>
        {!image ? (
          <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div className="space-y-1 mb-6">
              <div className="text-[10px] font-bold text-white uppercase tracking-widest">{description}</div>
              <div className="text-[8px] text-white/10 uppercase tracking-[0.3em]">Pending_Import</div>
            </div>

            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-white text-black rounded-lg flex items-center justify-center transition-all active:scale-95 font-bold text-[9px] uppercase tracking-widest hover:bg-indigo-50"
            >
              Select Image
            </button>
            
            <input 
              ref={fileInputRef}
              type="file" 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange} 
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col p-2">
            <div className="relative flex-1 rounded-xl overflow-hidden bg-black shadow-inner">
              <div 
                className="absolute inset-0 bg-contain bg-center bg-no-repeat transition-transform duration-500 group-hover:scale-105"
                style={{ backgroundImage: `url(${image})` }}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                <button
                  onClick={(e) => { e.preventDefault(); onClear(); }}
                  className="p-3 bg-red-600 text-white rounded-xl active:scale-90 transition-all shadow-xl hover:bg-red-500"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="px-2 py-2.5 flex items-center justify-between">
               <div className="flex items-center space-x-2">
                 <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
                 <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Asset_Buffered</span>
               </div>
               <span className="text-[7px] font-bold text-white/5 uppercase font-mono tracking-tighter">DATA_SYNC_OK</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUploader;
