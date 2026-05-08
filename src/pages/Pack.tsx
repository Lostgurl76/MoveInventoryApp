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

const Pack = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemNameInputRef = useRef<HTMLInputElement>(null);
  
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
  const [boxForm, setBoxForm] = useState({ room: '' as Room | '', location: '' as Location | '' });
  const [itemForm, setItemForm] = useState({
    item_name: '',
    count: 1,
    item_type: 'Other' as ItemType,
    description: '',
    serial_number: '',
    est_value: '',
    item_notes: '',
    image: ''
  });

  // Persistence & Resume
  useEffect(() => {
    const saved = localStorage.getItem('active_box_session');
    if (saved) {
      const parsed: ActiveBoxSession = JSON.parse(saved);
      setSession(parsed);
      
      if (parsed.label_status === 'PRINTED_CONFIRMED') setAppState('ACTIVE_BOX_ADDING_ITEMS');
      else if (parsed.label_status === 'SKIPPED') setAppState('ACTIVE_BOX_ADDING_ITEMS');
      else setAppState('ACTIVE_BOX_LABEL_PENDING');
      
      fetchRecentItems(parsed.id);
    } else {
      fetchRecentBoxes();
    }
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
        .insert({ room: boxForm.room, location: boxForm.location })
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
        created_at: new Date().toISOString()
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
        count: itemForm.count,
        item_type: itemForm.item_type,
        description: itemForm.description,
        serial_number: itemForm.serial_number,
        est_value: itemForm.est_value ? parseFloat(itemForm.est_value) : null,
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
    setBoxForm({ room: '', location: '' });
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
                    {['Kitchen', 'Living Room', 'Dining Room', 'Bedroom', 'Primary Bedroom', 'Bathroom', 'Primary Bathroom', 'Office', 'Garage', 'Storage', 'Laundry', 'Entryway', 'Other'].map(r => (
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
                        created_at: box.created_at
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
                </div>
              </div>
            </div>

            {/* Label Section */}
            {appState === 'ACTIVE_BOX_LABEL_PENDING' && (
              <div className="bg-white rounded-[18px] p-5 shadow-[0_6px_18px_rgba(31,20,70,0.08)] space-y-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-[#F6F4FB] rounded-lg">
                    <QRCodeSVG value={session?.label_value || ''} size={64} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#5F5A72]">Box Label URL</p>
                    <p className="text-[11px] text-[#8B849E] truncate">{session?.label_value}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(session?.label_value || '');
                      updateLabelStatus('COPIED');
                      showSuccess('URL Copied');
                    }}
                    className="h-10 bg-[#F1EFF8] text-[#4B2FBF] rounded-[10px] text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Copy size={16} /> Copy
                  </button>
                  <button 
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: `Box #${session?.box_number}`, url: session?.label_value });
                        updateLabelStatus('SHARED');
                      }
                    }}
                    className="h-10 bg-[#F1EFF8] text-[#4B2FBF] rounded-[10px] text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Share2 size={16} /> Share
                  </button>
                </div>
                <div className="pt-2 space-y-2">
                  <button 
                    onClick={() => updateLabelStatus('PRINTED_CONFIRMED')}
                    className="w-full h-11 bg-[#14B8A6] text-white rounded-[12px] text-[14px] font-semibold active:scale-95"
                  >
                    Mark Label Printed
                  </button>
                  <button 
                    onClick={() => updateLabelStatus('SKIPPED')}
                    className="w-full h-11 text-[#8B849E] text-[13px] font-medium active:scale-95"
                  >
                    Skip for now
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
                      value={itemForm.count}
                      onChange={e => setItemForm({ ...itemForm, count: parseInt(e.target.value) || 1 })}
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
                      {['Clothing', 'Kitchenware', 'Cookware', 'Electronics', 'Books', 'Furniture', 'Bedding', 'Tools', 'Bathroom', 'Documents', 'Décor', 'Art', 'Jewelry', 'Toys', 'Sports Equipment', 'Food', 'Cleaning Supplies', 'Other'].map(t => (
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
                      <div className="grid grid-cols-2 gap-3">
                        <input 
                          placeholder="Est. Value ($)"
                          type="number"
                          value={itemForm.est_value}
                          onChange={e => setItemForm({ ...itemForm, est_value: e.target.value })}
                          className="w-full h-12 px-4 rounded-[12px] border border-[#E6E0F0] outline-none"
                        />
                        <input 
                          placeholder="Serial #"
                          value={itemForm.serial_number}
                          onChange={e => setItemForm({ ...itemForm, serial_number: e.target.value })}
                          className="w-full h-12 px-4 rounded-[12px] border border-[#E6E0F0] outline-none"
                        />
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

                <button 
                  type="submit"
                  disabled={loading || !itemForm.item_name}
                  className="w-full h-12 bg-[#6D4CFF] text-white rounded-[14px] font-semibold active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <><Plus size={20} /> Add Item</>}
                </button>
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