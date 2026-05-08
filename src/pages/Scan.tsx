import React, { useEffect, useRef, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useNavigate } from 'react-router-dom';
import { X, AlertCircle } from 'lucide-react';

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): {
        detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
      };
    };
  }
}

const Scan = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopScannerRef = useRef<() => void>(() => {});
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  const stopScanner = () => {
    stopScannerRef.current();
  };

  const handleResult = (text: string) => {
    if (text.includes('box=')) {
      const boxNumber = text.split('box=')[1];
      stopScanner();
      navigate(`/items-by-box?box=${boxNumber}`);
    }
  };

  const startScanner = async () => {
    stopScanner();
    setError('');

    let stream: MediaStream | undefined;
    let animFrame = 0;
    let stopped = false;

    const cleanup = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(animFrame);
      stream?.getTracks().forEach(track => track.stop());
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      setScanning(false);
    };

    stopScannerRef.current = cleanup;

    try {
      if (!window.BarcodeDetector) {
        setError('Camera not available. Use manual entry below.');
        return;
      }

      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      if (stopped || !videoRef.current) {
        cleanup();
        return;
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScanning(true);

      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });

      const detect = async () => {
        if (stopped || !videoRef.current) return;

        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0 && codes[0].rawValue) {
            handleResult(codes[0].rawValue);
            return;
          }
        } catch {
          // Ignore frame-level detection errors and continue scanning.
        }

        animFrame = requestAnimationFrame(detect);
      };

      detect();
    } catch (e: any) {
      cleanup();
      setError(
        e.name === 'NotAllowedError'
          ? 'Camera permission denied. Use manual entry below.'
          : 'Camera not available. Use manual entry below.'
      );
    }
  };

  useEffect(() => {
    startScanner();
    return () => stopScanner();
  }, []);

  return (
    <Layout title="Scan QR Code" showBack>
      <div className="space-y-6">
        <div className="relative aspect-square bg-black rounded-[22px] overflow-hidden shadow-xl">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <div className="absolute inset-0 border-[2px] border-white/20 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-[#6D4CFF] rounded-3xl">
              <div className="absolute inset-0 bg-[#6D4CFF]/10 animate-pulse rounded-3xl" />
            </div>
          </div>

          {error && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <AlertCircle size={48} className="text-[#F43F5E]" />
              <p className="text-white font-medium">{error}</p>
              <button
                onClick={startScanner}
                className="px-6 py-2 bg-[#6D4CFF] text-white rounded-full font-bold"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {scanning && (
          <button
            onClick={stopScanner}
            className="w-full h-12 bg-white border border-[#F3D7DE] text-[#E11D48] rounded-[16px] font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <X size={18} /> Stop Camera
          </button>
        )}

        <div className="bg-white p-6 rounded-[22px] shadow-sm space-y-4">
          <h3 className="font-bold text-[#17142A]">How to scan</h3>
          <p className="text-[13px] text-[#8B849E] leading-relaxed">
            Point your camera at the QR code on the box label. We'll automatically take you to the box contents.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Scan;
