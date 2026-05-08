import React, { useRef, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useNavigate } from 'react-router-dom';
import { ScanLine, ArrowRight, Loader2 } from 'lucide-react';

const Scan = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [decoding, setDecoding] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [manualError, setManualError] = useState('');

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setDecoding(true);
    const file = e.target.files?.[0];
    if (!file) {
      setDecoding(false);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('https://api.qrserver.com/v1/read-qr-code/', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      const result = data?.[0]?.symbol?.[0]?.data;
      if (result) {
        handleResult(result);
      } else {
        setError('No QR code found. Try again with better lighting or a closer shot.');
      }
    } catch {
      setError('Could not read QR code. Try again.');
    } finally {
      setDecoding(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleResult = (qrUrl: string) => {
    try {
      const url = new URL(qrUrl);
      const boxParam = url.searchParams.get('box');
      const boxNum = boxParam ? parseInt(boxParam, 10) : NaN;
      if (!isNaN(boxNum) && boxNum > 0) {
        navigate(`/items-by-box?box=${boxNum}`);
      } else {
        setError('Unrecognised QR code');
      }
    } catch {
      setError('Unrecognised QR code');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError('');
    const num = parseInt(manualInput.trim(), 10);
    if (isNaN(num) || num <= 0) {
      setManualError('Enter a valid box number');
      return;
    }
    navigate(`/items-by-box?box=${num}`);
  };

  return (
    <Layout title="Scan QR Code">
      <div className="space-y-6">
        <div
          onClick={() => !decoding && inputRef.current?.click()}
          className="bg-[#17142A] rounded-[22px] aspect-square flex flex-col items-center justify-center gap-4 cursor-pointer active:opacity-80 transition-opacity shadow-[0_12px_32px_rgba(31,20,70,0.24)]"
        >
          {decoding ? (
            <>
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center">
                <Loader2 size={40} className="text-white animate-spin" />
              </div>
              <p className="text-white font-semibold text-[16px]">Reading QR code...</p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center">
                <ScanLine size={40} className="text-white" />
              </div>
              <p className="text-white font-semibold text-[16px]">Tap to scan QR code</p>
              <p className="text-white/50 text-[13px] text-center px-8">Opens your camera to capture the box label</p>
            </>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleCapture}
        />

        {error && (
          <div className="bg-[#FFE4E6] border border-[#F43F5E]/20 p-3 rounded-[12px]">
            <p className="text-[13px] text-[#9F1239] font-medium">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-[#E6E0F0]" />
          <span className="text-[12px] text-[#8B849E] font-medium">or enter manually</span>
          <div className="flex-1 h-px bg-[#E6E0F0]" />
        </div>

        <div className="bg-white rounded-[18px] p-5 shadow-[0_6px_18px_rgba(31,20,70,0.08)] space-y-4">
          <p className="text-[13px] font-medium text-[#5F5A72]">Go directly to a box by number</p>
          <form onSubmit={handleManualSubmit} className="flex gap-3">
            <div className="flex-1">
              <input
                type="number"
                inputMode="numeric"
                value={manualInput}
                onChange={e => {
                  setManualInput(e.target.value);
                  setManualError('');
                }}
                placeholder="Box number"
                className="w-full h-12 px-4 rounded-[12px] border border-[#E6E0F0] focus:border-[#6D4CFF] focus:ring-4 focus:ring-[#6D4CFF]/10 outline-none text-[16px]"
              />
              {manualError && (
                <p className="text-[12px] text-[#F43F5E] mt-1 ml-1">{manualError}</p>
              )}
            </div>
            <button
              type="submit"
              className="w-12 h-12 bg-[#6D4CFF] text-white rounded-[12px] flex items-center justify-center active:scale-95 transition-transform shrink-0"
            >
              <ArrowRight size={20} />
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default Scan;
