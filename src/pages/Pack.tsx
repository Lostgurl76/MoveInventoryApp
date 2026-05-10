import React, { useState, useEffect, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { AppState, ActiveBoxSession, Room, Location, ItemType, LabelStatus } from '@/types/inventory';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Share2, Check, ChevronDown, ChevronUp, Trash2, Package, Plus, X, Camera, Loader2 } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { uploadItemImage } from '@/utils/storage';
import { LocationBadge } from '@/components/LocationBadge';

const Pack = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemNameInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  const [appState, setAppState] = useState<AppState>('NO_ACTIVE_BOX');
  const [session, setSession] = useState<ActiveBoxSession | null>(null);
  const [recentItems, setRecentItems] = useState<any[]>([]);
  const [recentBoxes, setRecentBoxes] = useState<any[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [undoItem, setUndoItem] = useState<any | null>(null);
  const undoTimer = useRef<NodeJS.Timeout | null>(null);

  // Form States
  const [boxForm, setBoxForm] = useState({ room: '' as Room | '', location: '' as Location | '', box_label: '' });
  const [itemForm, setItemForm] = useState<{
    item_name: string;
    count: number | '';
    item_type: ItemType;
    description: string;
    serial_number: string;
    est_value: string;
    item_notes: string;
    image: string;
  }>({
    item_name: '',
    count: 1,
    item_type: 'Misc.' as ItemType,
    description: '',
    serial_number: '',
    est_value: '',
    item_notes: '',
    image: ''
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low' | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>('');
  const [promptSerial, setPromptSerial] = useState(false);
  const [replacementValue, setReplacementValue] = useState<number | ''>('');
  const [showAbandon, setShowAbandon] = useState(false);

  // Persistence & Resume
  useEffect(() => {
    const resumeSession = async () => {
      const saved = localStorage.getItem('active_box_session');
      if (saved) {
        const parsed: ActiveBoxSession = JSON.parse(saved);
        
        // Sync real count from DB
        const { count } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('box_id', parsed.id);

        if (count !== null) parsed.item_count = count;
        
        setSession(parsed);
        
        if (parsed.label_status === 'PRINTED_CONFIRMED') setAppState('ACTIVE_BOX_ADDING_ITEMS');
        else if (parsed.label_status === 'SKIPPED') setAppState('ACTIVE_BOX_ADDING_ITEMS');
        else setAppState('ACTIVE_BOX_LABEL_PENDING');
        
        fetchRecentItems(parsed.id);
      } else {
        fetchRecentBoxes();
      }
    };
    resumeSession();
  }, []);

  useEffect(() => {
    if (session) {
      localStorage.setItem('active_box_session', JSON.stringify(session));
    } else {
      localStorage.removeItem('active_box_session');
      fetchRecentBoxes();
    }
  }, [session]);

  const fetchRecentItems = async (boxId: number) => {
    const { data } = await supabase
      .from('items')
      .select('*')
      .eq('box_id', boxId)
      .order('item_id', { ascending: false })
      .limit(10);
    if (data) setRecentItems(data);
  };

  const fetchRecentBoxes = async () => {
    const { data } = await supabase
      .from('boxes')
      .select('*, items(count)')
      .order('id', { ascending: false })
      .limit(5);
    if (data) {
      const processed = data.map(b => ({
        ...b,
        itemCount: b.items?.reduce((acc: number, curr: any) => acc + (curr.count || 1), 0) || 0
      }));
      setRecentBoxes(processed);
    }
  };

  // Handlers
  const handleCreateBox = async () => {
    if (!boxForm.room || !boxForm.location) return;
    setLoading(true);
    try {
      const { data: box, error } = await supabase
        .from('boxes')
        .insert({ 
          room: boxForm.room, 
          location: boxForm.location,
          box_label: boxForm.box_label || null
        })
        .select()
        .single();

      if (error) throw error;

      const qrValue = `https://move-inventory-app-chi.vercel.app/items-by-box?box=${box.box_number}`;
      await supabase.from('boxes').update({ qr_code_value: qrValue }).eq('id', box.id);

      const newSession: ActiveBoxSession = {
        id: box.id,
        box_number: box.box_number,
        room: box.room,
        location: box.location,
        label_value: qrValue,
        label_status: 'NOT_PRINTED',
        item_count: 0,
        created_at: new Date().toISOString(),
        box_label: box.box_label
      };

      setSession(newSession);
      setAppState('ACTIVE_BOX_LABEL_PENDING');
      showSuccess(`Box #${box.box_number} created!`);
    } catch (err) {
      showError('Failed to create box');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const url = await uploadItemImage(file);
    if (url) {
      setItemForm(prev => ({ ...prev, image: url }));
      showSuccess('Photo uploaded');
    } else {
      showError('Upload failed');
    }
    setUploading(false);
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCapturedPhoto(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
    setAiLoading(true);
    setAiError('');
    setConfidence(null);
    setShowAbandon(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/analyze-item', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.error) throw new Error('AI unavailable');

      setItemForm(prev => ({
        ...prev,
        item_name: data.item_name || '',
        item_type: (data.item_type || prev.item_type) as ItemType,
        description: data.description || '',
        est_value: data.est_value ? String(data.est_value) : ''
      }));
      setReplacementValue(data.replacement_value || '');
      setPromptSerial(data.prompt_serial || false);
      setConfidence(data.confidence || 'low');
    } catch {
      setAiError('AI unavailable — enter details manually');
    } finally {
      setAiLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSerialPhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch('/api/analyze-serial', { method: 'POST', body: formData });
      const data = await response.json();
      if (data.serial_number) {
        setItemForm(prev => ({ ...prev, serial_number: data.serial_number }));
      }
    } catch {}

    if (e.target) e.target.value = '';
  };

  const handleAbandon = () => {
    setCapturedPhoto(null);
    setPhotoPreviewUrl('');
    setConfidence(null);
    setPromptSerial(false);
    setReplacementValue('');
    setShowAbandon(false);
    setAiError('');
    setItemForm({
      item_name: '',
      count: 1,
      item_type: 'Misc.' as ItemType,
      description: '',
      serial_number: '',
      est_value: '',
      item_notes: '',
      image: ''
    });
  };

  const updateLabelStatus = (status: LabelStatus) => {
    if (!session) return;
    const nextState: AppState = (status === 'PRINTED_CONFIRMED' || status === 'SKIPPED') 
      ? 'ACTIVE_BOX_ADDING_ITEMS' 
      : 'ACTIVE_BOX_LABEL_PENDING';
    
    setSession({ ...session, label_status: status });
    setAppState(nextState);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.item_name || !session) return;
    setLoading(true);

    try {
      const { error } = await supabase.from('items').insert({
        item_name: itemForm.item_name,
        count: itemForm.count || 1,
        item_type: itemForm.item_type,
        description: itemForm.description,
        serial_number: itemForm.serial_number,
        est_value: itemForm.est_value ? parseFloat(itemForm.est_value) : null,
        replacement_value: replacementValue || null,
        item_notes: itemForm.item_notes,
        image: itemForm.image,
        box_id: session.id,
        location: session.location,
        room: session.room
      });

      if (error) throw error;

      setSession({ ...session, item_count: session.item_count + 1 });
      fetchRecentItems(session.id);
      
      // Reset volatile fields
      setItemForm(prev => ({
        ...prev,
        item_name: '',
        description: '',
        serial_number: '',
        est_value: '',
        item_notes: '',
        image: ''
      }));
      setReplacementValue('');
      setCapturedPhoto(null);
      setPhotoPreviewUrl('');
      setConfidence(null);
      setPromptSerial(false);
      setShowAbandon(false);
      setAiError('');
      setIsExpanded(false);
      showSuccess('Item added');
      
      // Refocus input
      itemNameInputRef.current?.focus();
    } catch (err) {
      showError('Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    const item = recentItems.find(i => i.item_id === itemId);
    setUndoItem(item);
    setRecentItems(prev => prev.filter(i => i.item_id !== itemId));
    
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(async () => {
      await supabase.from('items').delete().eq('item_id', itemId);
      setUndoItem(null);
    }, 3000);
  };

  const handleUndo = () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    if (undoItem) {
      setRecentItems(prev => [undoItem, ...prev]);
      setUndoItem(null);
    }
  };

  const handleComplete = () => setAppState('ACTIVE_BOX_COMPLETE');

  const resetSession = () => {
    setSession(null);
    setAppState('NO_ACTIVE_BOX');
    setBoxForm({ room: '', location: '', box_label: '' });
    setRecentItems([]);
  };

  // Render Helpers
  if (appState === 'ACTIVE_BOX_COMPLETE') {
    return (
      <Layout title="Box Complete">
        <div className="bg-white rounded-[22px] p-8 shadow-[0_12px_32px_rgba(31,20,70,0.16)] text-center space-y-6">
          <div className="w-20 h-20 bg-[#DDFBF5] text-[#14B8A6] rounded-full flex items-center justify-center mx-auto">
            <Check size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#17142A]">Box #{session?.box_number} Ready!</h2>
            <p className="text-[#8B849E] mt-1">{session?.item_count} items packed for {session?.room}</p>
          </div>
          <div className="space-y-3 pt-4">
            <button onClick={resetSession} className="w-full h-12 bg-[#6D4CFF] text-white rounded-[14px] font-semibold active:scale-95 transition-transform">
              Create Next Box
            </button>
            <button onClick={() => navigate(`/items-by-box?box=${session?.box_number}`)} className="w-full h-12 bg-white border border-[#DDD6EA] text-[#4B2FBF] rounded-[12px] font-semibold active:scale-95 transition-transform">
              View Box Contents
            </button>
            <button onClick={() => navigate('/')} className="w-full h-12 text-[#8B849E] font-medium active:scale-95 transition-transform">
              Return Home
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={appState === 'NO_ACTIVE_BOX' ? 'Pack a Box' : `Packing Box #${session?.box_number}`}>
      <div className="space-y-6">
        {appState === 'NO_ACTIVE_BOX' ? (
          <div className="space-y-8">
            <div className="bg-white rounded-[22px] p-6 shadow-[0_12px_32px_rgba(31,20,70,0.12)] space-y-5">
              <div className="space-y-4">
                <div>
                  <label className="text-[13px] font-medium text-[#5F5A72] mb-2 block">Room</label>
                  <select 
                    value={boxForm.room}
                    onChange={e => setBoxForm({ ...boxForm, room: e.target.value as Room })}
                    className="w-full h-12 px-4 rounded-[12px] border border-[#E6E0F0] focus:border-[#6D4CFF] focus:ring-4 focus:ring-[#6D4CFF]/10 outline-none appearance-none bg-white"
                  >
                    <option value="">Select Room</option>
                    {['Bathroom', 'Bedroom', 'Dining', 'Garage', 'General', 'Hobby', 'Living Room', 'Kitchen', 'Office', 'Pantry', 'Patio', 'Puppers', 'Storage'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[#5F5A72] mb-2 block">Location</label>
                  <select 
                    value={boxForm.location}
                    onChange={e => setBoxForm({ ...boxForm, location: e.target.value as Location })}
                    className="w-full h-12 px-4 rounded-[12px] border border-[#E6E0F0] focus:border-[#6D4CFF] focus:ring-4 focus:ring-[#6D4CFF]/10 outline-none appearance-none bg-white"
                  >
                    <option value="">Select Location</option>
                    {['Pod', 'Mae Car', 'Ant Car', 'Unassigned'].map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[#5F5A72] mb-2 block">Box label (optional)</label>
                  <input 
                    value={boxForm.box_label}
                    onChange={e => setBoxForm({ ...boxForm, box_label: e.target.value })}
                    placeholder="e.g. Mae's winter clothes"
                    className="w-full h-12 px-4 rounded-[12px] border border-[#E6E0F0] focus:border-[#6D4CFF] focus:ring-4 focus:ring-[#6D4CFF]/10 outline-none"
                  />
                </div>
              </div>
              <button 
                onClick={handleCreateBox}
                disabled={!boxForm.room || !boxForm.location || loading}
                className="w-full h-12 bg-[#6D4CFF] text-white rounded-[14px] font-semibold disabled:bg-[#DCD6F5] active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <><Plus size={20} /> Create Box</>}
              </button>
            </div>

            {/* Recent Boxes List */}
            <div className="space-y-3">
              <h3 className="text-[15px] font-bold text-[#17142A] px-1">Recent Boxes</h3>
              <div className="grid gap-3">
                {recentBoxes.map(box => (
                  <button 
                    key={box.id}
                    onClick={() => {
                      const resumeSession: ActiveBoxSession = {
                        id: box.id,
                        box_number: box.box_number,
                        room: box.room,
                        location: box.location,
                        label_value: box.qr_code_value,
                        label_status: 'PRINTED_CONFIRMED',
                        item_count: box.itemCount,
                        created_at: box.created_at,
                        box_label: box.box_label
                      };
                      setSession(resumeSession);
                      setAppState('ACTIVE_BOX_ADDING_ITEMS');
                      fetchRecentItems(box.id);
                    }}
                    className="bg-white p-4 rounded-[18px] shadow-[0_6px_18px_rgba(31,20,70,0.08)] flex items-center justify-between text-left active:scale-[0.98] transition-transform"
                  >
                    <div>
                      <p className="font-bold text-[#17142A]">Box #{box.box_number}</p>
                      <p className="text-[12px] text-[#8B849E]">{box.room} • {box.itemCount} items</p>
                      {box.box_label && <p className="text-[11px] text-[#8B849E] italic mt-0.5">{box.box_label}</p>}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#F1EFF8] flex items-center justify-center text-[#6D4CFF]">
                      <Plus size={18} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Box Header */}
            <div className="bg-gradient-to-br from-[#6D4CFF] via-[#7C3AED] to-[#14B8A6] rounded-[22px] p-6 text-white shadow-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[13px] font-medium opacity-80">Active Box</p>
                  <h2 className="text-3xl font-bold">#{session?.box_number}</h2>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{session?.room}</p>
                  <p className="text-[13px] opacity-80">{session?.location}</p>
                  {session?.box_label && <p className="text-[13px] opacity-70 mt-1 italic">{session.box_label}</p>}
                </div>
              </div>
            </div>

            {/* Label Section - Redesigned for Phomemo M110 */}
            {appState === 'ACTIVE_BOX_LABEL_PENDING' && (
              <div className="space-y-6">
                <div className="bg-white rounded-[16px] border border-[#E6E0F0] shadow-lg max-width-[280px] mx-auto aspect-square p-4 flex flex-col items-center justify-between text-center">
                  <div className="w-full flex justify-between items-center">
                    <LocationBadge location={session?.location || 'Unassigned'} />
                    <span className="text-[11px] font-semibold text-[#5F5A72] uppercase tracking-wider">{session?.room}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[13px] font-medium text-[#8B849E]">Box #</span>
                    <span className="text-[52px] font-black text-[#17142A] leading-none">{session?.box_number}</span>
                  </div>

                  {session?.box_label && (
                    <p className="text-[12px] font-medium text-[#5F5A72] italic px-2 line-clamp-2">{session.box_label}</p>
                  )}

                  <div className="p-1 bg-white">
                    <QRCodeSVG value={session?.label_value || ''} size={96} />
                  </div>

                  <p className="text-[8px] text-[#8B849E] break-all text-center px-2 w-full opacity-60">{session?.label_value}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(session?.label_value || '');
                      updateLabelStatus('COPIED');
                      showSuccess('URL Copied');
                    }}
                    className="h-12 bg-[#F1EFF8] text-[#4B2FBF] rounded-[12px] text-[14px] font-bold flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Copy size={18} /> Copy
                  </button>
                  <button 
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ 
                          title: `Box #${session?.box_number} — ${session?.room}`, 
                          text: session?.box_label || '',
                          url: session?.label_value 
                        });
                        updateLabelStatus('SHARED');
                      }
                    }}
                    className="h-12 bg-[#F1EFF8] text-[#4B2FBF] rounded-[12px] text-[14px] font-bold flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Share2 size={18} /> Share
                  </button>
                  <button 
                    onClick={() => updateLabelStatus('PRINTED_CONFIRMED')}
                    className="h-12 bg-[#14B8A6] text-white rounded-[12px] text-[14px] font-bold active:scale-95"
                  >
                    Mark Printed
                  </button>
                  <button 
                    onClick={() => updateLabelStatus('SKIPPED')}
                    className="h-12 bg-white border border-[#E6E0F0] text-[#8B849E] rounded-[12px] text-[14px] font-bold active:scale-95"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}

            {/* Warning Banner */}
            {(appState === 'ACTIVE_BOX_LABEL_PENDING' || session?.label_status === 'SKIPPED') && (
              <div className="bg-[#FEF3C7] border border-[#F59E0B]/20 p-3 rounded-[12px] flex items-center gap-3">
                <div className="w-8 h-8 bg-[#F59E0B] text-white rounded-full flex items-center justify-center shrink-0">
                  <Package size={16} />
                </div>
                <p className="text-[12px] text-[#92400E] font-medium leading-tight">
                  Label not confirmed. Don't forget to print and attach it to the box!
                </p>
              </div>
            )}

            {/* Quick Add Form */}
            <div className={cn(
              "bg-white rounded-[22px] p-6 shadow-[0_12px_32px_rgba(31,20,70,0.12)] space-y-4",
              appState === 'ACTIVE_BOX_LABEL_PENDING' && "opacity-60 pointer-events-none grayscale-[0.5]"
            )}>
              <form onSubmit={handleAddItem} className="space-y-4">
                <div className="space-y-3">
                  {capturedPhoto && photoPreviewUrl ? (
                    <div className="relative">
                      <img src={photoPreviewUrl} className="w-full h-40 object-cover rounded-[12px]" alt="Captured item" />
                      {aiLoading && (
                        <div className="absolute inset-0 bg-black/50 rounded-[12px] flex flex-col items-center justify-center gap-2">
                          <Loader2 size={28} className="text-white animate-spin" />
                          <p className="text-white text-[13px] font-medium">Analyzing item...</p>
                        </div>
                      )}
                      {!aiLoading && (
                        <label htmlFor="retake-input" className="absolute bottom-2 right-2 bg-black/60 text-white text-[12px] px-3 py-1.5 rounded-full cursor-pointer active:opacity-70">
                          Retake
                        </label>
                      )}
                      <input id="retake-input" type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-3 h-14 bg-[#EEE9FF] rounded-[14px] cursor-pointer active:opacity-80 transition-opacity border-2 border-dashed border-[#6D4CFF]/30">
                      <Camera size={22} className="text-[#6D4CFF]" />
                      <span className="text-[15px] font-semibold text-[#6D4CFF]">Take photo to auto-fill</span>
                      <input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} style={{ position: 'fixed', top: '-100px', left: '-100px', width: '1px', height: '1px', opacity: 0 }} />
                    </label>
                  )}

                  {confidence === 'low' && !aiLoading && (
                    <div className="bg-[#FEF3C7] border border-[#F59E0B]/20 p-3 rounded-[12px]">
                      <p className="text-[13px] text-[#92400E] font-medium">⚠ AI couldn't confidently identify this item — please review all fields</p>
                    </div>
                  )}
                  {confidence === 'medium' && !aiLoading && (
                    <div className="flex items-center gap-2 px-1">
                      <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                      <p className="text-[12px] text-[#92400E]">AI is moderately confident — verify the item name</p>
                    </div>
                  )}

                  {aiError && (
                    <div className="bg-[#FFE4E6] p-3 rounded-[12px]">
                      <p className="text-[13px] text-[#9F1239]">{aiError}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[13px] font-medium text-[#5F5A72] mb-1.5 block">Item Name</label>
                    <input 
                      ref={itemNameInputRef}
                      required
                      value={itemForm.item_name}
                      onChange={e => setItemForm({ ...itemForm, item_name: e.target.value })}
                      placeholder="What's inside?"
                      className="w-full h-12 px-4 rounded-[12px] border border-[#E6E0F0] focus:border-[#6D4CFF] outline-none"
                    />
                  </div>
                  <div className="w-20">
                    <label className="text-[13px] font-medium text-[#5F5A72] mb-1.5 block">Qty</label>
                    <input 
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={itemForm.count}
                      onFocus={e => e.target.select()}
                      onChange={e => setItemForm({ ...itemForm, count: e.target.value === '' ? '' : parseInt(e.target.value) || 1 })}
                      onBlur={e => { if (!e.target.value) setItemForm({ ...itemForm, count: 1 }) }}
                      className="w-full h-12 px-3 rounded-[12px] border border-[#E6E0F0] focus:border-[#6D4CFF] outline-none text-center"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[13px] font-medium text-[#5F5A72] mb-1.5 block">Type</label>
                    <select 
                      value={itemForm.item_type}
                      onChange={e => setItemForm({ ...itemForm, item_type: e.target.value as ItemType })}
                      className="w-full h-12 px-3 rounded-[12px] border border-[#E6E0F0] bg-white outline-none"
                    >
                      {['Cleaning', 'Clothing', 'Cookware', 'Crafts', 'Decor', 'Electronics', 'Food', 'Furniture', 'Jewelry', 'Keepsakes', 'Misc.', 'Puppers', 'Soft Goods', 'Toiletries', 'Utility'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                    />
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className={cn(
                        "w-full h-12 border border-[#E6E0F0] rounded-[12px] flex items-center justify-center gap-2 text-[#8B849E] active:scale-95 transition-all",
                        itemForm.image && "border-[#14B8A6] text-[#14B8A6] bg-[#DDFBF5]"
                      )}
                    >
                      {uploading ? <Loader2 className="animate-spin" size={20} /> : itemForm.image ? <Check size={20} /> : <Camera size={20} />}
                      {itemForm.image ? 'Photo Added' : 'Photo'}
                    </button>
                  </div>
                </div>

                {/* Expanded Fields */}
                <button 
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1 text-[13px] font-semibold text-[#6D4CFF] py-1"
                >
                  {isExpanded ? <><ChevronUp size={16} /> Less details</> : <><ChevronDown size={16} /> More details</>}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-4"
                    >
                      <textarea 
                        placeholder="Description"
                        value={itemForm.description}
                        onChange={e => setItemForm({ ...itemForm, description: e.target.value })}
                        className="w-full p-4 rounded-[12px] border border-[#E6E0F0] outline-none min-h-[80px]"
                      />

                      {promptSerial && (
                        <div className="bg-[#EEE9FF] p-4 rounded-[14px] space-y-3 border border-[#6D4CFF]/20">
                          <p className="text-[13px] font-semibold text-[#4B2FBF]">Serial number recommended for customs and insurance</p>
                          <input
                            value={itemForm.serial_number || ''}
                            onChange={e => { setItemForm(prev => ({ ...prev, serial_number: e.target.value })); setConfidence(null); }}
                            placeholder="Type serial number"
                            className="w-full h-12 px-4 rounded-[12px] border border-[#E6E0F0] focus:border-[#6D4CFF] outline-none text-[16px] bg-white"
                          />
                          <div className="flex gap-2">
                            <label htmlFor="serial-photo-input" className="flex-1 h-10 bg-white border border-[#6D4CFF] text-[#6D4CFF] rounded-[10px] flex items-center justify-center gap-2 text-[13px] font-semibold cursor-pointer active:opacity-70">
                              <Camera size={16} /> Scan serial number
                            </label>
                            <button type="button" onClick={() => setPromptSerial(false)} className="px-4 h-10 text-[13px] text-[#8B849E] active:opacity-70">Skip</button>
                          </div>
                          <input id="serial-photo-input" type="file" accept="image/*" capture="environment" className="hidden" onChange={handleSerialPhotoCapture} />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[13px] font-medium text-[#5F5A72] mb-1.5 block">Est. value (USD)</label>
                          <input 
                            placeholder="0.00"
                            type="number"
                            inputMode="decimal"
                            value={itemForm.est_value}
                            onChange={e => setItemForm({ ...itemForm, est_value: e.target.value })}
                            className="w-full h-12 px-4 rounded-[12px] border border-[#E6E0F0] outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[13px] font-medium text-[#5F5A72] mb-1.5 block">Replacement value (USD)</label>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={replacementValue}
                            onChange={e => setReplacementValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
                            placeholder="0.00"
                            className="w-full h-12 px-4 rounded-[12px] border border-[#E6E0F0] focus:border-[#6D4CFF] outline-none text-[16px]"
                          />
                        </div>
                      </div>
                      <textarea 
                        placeholder="Notes"
                        value={itemForm.item_notes}
                        onChange={e => setItemForm({ ...itemForm, item_notes: e.target.value })}
                        className="w-full p-4 rounded-[12px] border border-[#E6E0F0] outline-none min-h-[80px]"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {showAbandon ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={handleAbandon} className="h-14 bg-white border-2 border-[#F43F5E] text-[#F43F5E] rounded-[16px] font-semibold active:scale-95 transition-transform">
                      Abandon Item
                    </button>
                    <button type="submit" disabled={!itemForm.item_name || loading} className="h-14 bg-[#6D4CFF] text-white rounded-[16px] font-semibold active:scale-95 transition-transform disabled:bg-[#DCD6F5] flex items-center justify-center gap-2">
                      {loading ? <Loader2 className="animate-spin" size={20} /> : 'Save Item'}
                    </button>
                  </div>
                ) : (
                  <button 
                    type="submit"
                    disabled={loading || !itemForm.item_name}
                    className="w-full h-12 bg-[#6D4CFF] text-white rounded-[14px] font-semibold active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <><Plus size={20} /> Add Item</>}
                  </button>
                )}
              </form>
            </div>

            {/* Recently Added */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-[15px] font-bold text-[#17142A]">Recently Added</h3>
                <span className="text-[13px] text-[#8B849E]">{session?.item_count} total</span>
              </div>
              
              {undoItem && (
                <div className="bg-[#17142A] text-white p-3 rounded-[12px] flex justify-between items-center animate-in fade-in slide-in-from-bottom-2">
                  <span className="text-[13px]">Item deleted</span>
                  <button onClick={handleUndo} className="text-[#6D4CFF] text-[13px] font-bold px-2">UNDO</button>
                </div>
              )}

              <div className="space-y-2">
                {recentItems.map(item => (
                  <motion.div 
                    key={item.item_id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white p-4 rounded-[16px] shadow-[0_4px_12px_rgba(31,20,70,0.06)] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {item.image && (
                        <img src={item.image} className="w-10 h-10 rounded-lg object-cover" alt="" />
                      )}
                      <div>
                        <p className="font-semibold text-[#17142A]">{item.item_name}</p>
                        <p className="text-[12px] text-[#8B849E]">{item.count}x • {item.item_type}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteItem(item.item_id)}
                      className="p-2 text-[#F43F5E] active:scale-90"
                    >
                      <Trash2 size={18} />
                    </button>
                  </motion.div>
                ))}
                {recentItems.length === 0 && (
                  <div className="text-center py-8 text-[#8B849E]">
                    <Package size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-[13px]">No items added yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Complete Button */}
            <div className="pt-4">
              <button 
                onClick={handleComplete}
                className="w-full h-14 bg-white border-2 border-[#6D4CFF] text-[#6D4CFF] rounded-[16px] font-bold active:scale-95 transition-transform"
              >
                Finish Box
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Pack;