
export interface ImageState {
  front: string | null;
  back: string | null;
}

export type DKGType = 'ORBITAL' | 'KINETIC' | 'AUDIO_REACTIVE';

export interface DKGManifest {
  version: "1.3.0";
  type: "DKG_MANIFEST";
  dkgType: DKGType;
  productName: string;
  timestamp: string;
  kinetics: {
    mode: 'ORBITAL';
    layout: "4x2";
    frames: number;
    scale: number;
    alignment: "CENTROID";
    physics: {
      friction: number;
      elasticity: number;
      blurThreshold: number;
    };
  };
  source_checksum: string;
  asset_data?: string;
}

export interface BatchItem {
  id: string;
  productName: string;
  status: 'PENDING' | 'SYNTHESIZING' | 'COMPLETE' | 'FAILED';
  progress: number;
  resultUrl?: string;
  error?: string;
  images: ImageState;
}
