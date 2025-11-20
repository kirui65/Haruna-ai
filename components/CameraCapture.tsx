import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, Camera, RefreshCw, ScanLine } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const startCamera = useCallback(async () => {
    // Stop existing stream if any
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: facingMode } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError('');
    } catch (err) {
      setError('Unable to access camera. Please check permissions.');
      console.error(err);
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startCamera]); // Re-run when startCamera changes (which depends on facingMode)

  const handleCapture = useCallback(() => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Flip horizontal if using front camera for mirror effect
        if (facingMode === 'user') {
             ctx.translate(canvas.width, 0);
             ctx.scale(-1, 1);
        }
        ctx.drawImage(videoRef.current, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        onCapture(base64);
        onClose();
      }
    }
  }, [onCapture, onClose, facingMode]);

  const toggleCamera = () => {
      setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
      <div className="w-full h-full md:h-auto md:max-w-xl bg-black md:bg-slate-900 md:rounded-3xl overflow-hidden shadow-2xl md:border border-slate-700 flex flex-col relative">
        
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-6 bg-gradient-to-b from-black/80 to-transparent">
            <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                <h3 className="text-white font-semibold flex items-center gap-2 text-sm">
                    <ScanLine size={16} className="text-indigo-400" /> 
                    Scanner Mode
                </h3>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white bg-black/40 backdrop-blur-md p-2 rounded-full border border-white/10 transition-all">
                <X size={24} />
            </button>
        </div>

        {/* Viewfinder */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
             {error ? (
                <div className="text-center px-6 py-8 bg-slate-800 rounded-xl border border-slate-700 m-4">
                     <p className="text-red-400 mb-2 font-medium">{error}</p>
                     <button onClick={() => startCamera()} className="text-indigo-400 hover:text-indigo-300 text-sm underline">Try Again</button>
                </div>
             ) : (
                 <>
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                    />
                    
                    {/* Scan Animation Line */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <div className="absolute w-full h-[2px] bg-indigo-500/80 shadow-[0_0_20px_rgba(99,102,241,0.8)] animate-[scan_2.5s_ease-in-out_infinite] top-0"></div>
                    </div>

                    {/* Overlay Corners */}
                    <div className="absolute inset-0 pointer-events-none m-8 md:m-12">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-500 rounded-tl-lg"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-500 rounded-tr-lg"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-500 rounded-bl-lg"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-500 rounded-br-lg"></div>
                    </div>
                    
                    {/* Grid */}
                    <div className="absolute inset-0 pointer-events-none opacity-20 m-8 md:m-12 grid grid-cols-3 grid-rows-3">
                        <div className="border-r border-white"></div>
                        <div className="border-r border-white"></div>
                        <div className="border-r border-transparent"></div>
                        <div className="border-t border-white col-span-3"></div>
                        <div className="border-t border-white col-span-3 row-start-3"></div>
                    </div>
                 </>
             )}
        </div>

        {/* Controls */}
        <div className="h-32 md:h-28 bg-black/90 md:bg-slate-800 flex justify-between items-center px-10 pb-8 md:pb-0">
             <div className="w-12"></div> {/* Spacer */}
             
             {!error && (
                 <button 
                    onClick={handleCapture}
                    className="group relative"
                 >
                    <div className="h-20 w-20 rounded-full border-4 border-white flex items-center justify-center transition-all group-active:scale-95">
                        <div className="h-16 w-16 rounded-full bg-white group-hover:bg-indigo-500 transition-colors"></div>
                    </div>
                 </button>
             )}
             
             <div className="w-12 flex justify-end">
                <button 
                    onClick={toggleCamera}
                    className="p-3 rounded-full bg-slate-800 md:bg-slate-700 text-white border border-white/10 hover:bg-slate-700 md:hover:bg-slate-600 transition-colors"
                >
                    <RefreshCw size={20} />
                </button>
             </div>
        </div>
      </div>
      
      <style>{`
        @keyframes scan {
          0% { top: 10%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default CameraCapture;