import React, { useEffect, useRef, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useNavigate } from 'react-router-dom';
import { Camera, X, Loader2, AlertCircle } from 'lucide-react';

declare global {
  interface Window {
    ZXing: any;
  }
}

const Scan = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<any>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [zxingLoaded, setZxingLoaded] = useState(false);

  useEffect(() => {
    const checkZXing = () => {
      if (window.ZXing) {
        setZxingLoaded(true);
        startScanner();
      } else {
        setTimeout(checkZXing, 100);
      }
    };
    checkZXing();
    return () => stopScanner();
  }, []);

  const handleResult = (text: string) => {
    if (text.includes('box=')) {
      const boxNumber = text.split('box=')[1];
      stopScanner();
      navigate(`/items-by-box?box=${boxNumber}`);
    }
  };

  const startScanner = async () => {
    if (!zxingLoaded || !window.ZXing) {
      setError('Scanner not ready yet, please wait');
      return;
    }
    setError('');
    setScanning(true);

    try {
      const codeReader = new window.ZXing.BrowserQRCodeReader();
      readerRef.current = codeReader;

      const devices = await window.ZXing.BrowserCodeReader.listVideoInputDevices();
      const back = devices.find((d: any) =>
        /back|rear|environment/i.test(d.label)
      ) || devices[devices.length - 1];

      await codeReader.decodeFromVideoDevice(
        back?.deviceId || undefined,
        videoRef.current,
        (result: any) => {
          if (result) handleResult(result.getText());
        }
      );
    } catch (e: any) {
      stopScanner();
      setError(
        e.name === 'NotAllowedError'
          ? 'Camera permission denied. Use manual entry below.'
          : 'Could not start camera. Use manual entry below.'
      );
    }
  };

  const stopScanner = () => {
    if (readerRef.current) {
      readerRef.current.reset?.();
    }
    setScanning(false);
  };

  return (
    <Layout title="Scan QR Code" showBack>
      <div className="space-y-6">
        <div className="relative aspect-square bg-black rounded-[22px] overflow-hidden shadow-xl">
          <video 
            ref={videoRef} 
            className="w-full h-full object-cover"
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