import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { Item, Box, ItemType } from '@/types/inventory';
import { showSuccess, showError } from '@/utils/toast';
import { Trash2, Save, Package, MapPin, Home, Tag, DollarSign, Hash, FileText, Camera, Loader2 } from 'lucide-react';
import { uploadItemImage } from '@/utils/storage';
import { cn } from '@/lib/utils';

const ItemDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [item, setItem] = useState<any>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const itemTypes: ItemType[] = ['Cleaning', 'Clothing', 'Cookware', 'Crafts', 'Decor', 'Electronics', 'Food', 'Furniture', 'Jewelry', 'Keepsakes', 'Misc.', 'Puppers', 'Soft Goods', 'Toiletries', 'Utility'];

  useEffect(() => {
    const fetchItem = async () => {
      const [{ data: itemData }, { data: boxesData }] = await Promise.all([
        supabase
          .from('items')
          .select('*, boxes(*)')
          .eq('item_id', id)
          .single(),
        supabase
          .from('boxes')
          .select('*')
          .order('box_number', { ascending: true })
      ]);

      if (itemData) setItem(itemData);
      if (boxesData) setBoxes(boxesData);
      setLoading(false);
    };
    fetchItem();
  }, [id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const url = await uploadItemImage(file);
    if (url) {
      setItem({ ...item, image: url });
      showSuccess('Photo uploaded');
    } else {
      showError('Upload failed');
    }
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const boxChanged = item.box_id !== item.boxes?.id;
      const selectedBox = boxes.find(box => box.id === item.box_id);
      const updatePayload: Record<string, any> = {
        item_name: item.item_name,
        count: item.count,
        item_type: item.item_type,
        description: item.description,
        serial_number: item.serial_number,
        est_value: item.est_value,
        item_notes: item.item_notes,
        image: item.image
      };

      if (boxChanged && selectedBox) {
        updatePayload.box_id = selectedBox.id;
        updatePayload.location = selectedBox.location;
        updatePayload.room = selectedBox.room;
      }

      const { error } = await supabase
        .from('items')
        .update(updatePayload)
        .eq('item_id', id);
      if (error) throw error;
      showSuccess('Item updated');
    } catch (err) {
      showError('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await supabase.from('items').delete().eq('item_id', id);
      showSuccess('Item deleted');
      navigate(-1);
    } catch (err) {
      showError('Failed to delete');
    }
  };

  if (loading) return <Layout title="Loading..."><div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6D4CFF]"></div></div></Layout>;
  if (!item) return <Layout title="Not Found" showBack><div className="text-center py-20 text-[#8B849E]">Item not found</div></Layout>;

  const selectedBox = boxes.find(box => box.id === item.box_id);
  const displayedRoom = selectedBox?.room || item.room;
  const displayedLocation = selectedBox?.location || item.location;

  return (
    <Layout title="Item Details" showBack>
      <div className="space-y-6">
        {/* Image / Placeholder */}
        <div className="relative aspect-square bg-white rounded-[22px] shadow-[0_12px_32px_rgba(31,20,70,0.12)] overflow-hidden flex items-center justify-center">
          {item.image ? (
            <img src={item.image} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="text-center space-y-2">
              <Package size={64} className="mx-auto text-[#E6E0F0]" />
              <p className="text-[13px] text-[#8B849E]">No photo added</p>
            </div>
          )}
          
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleImageUpload}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-4 right-4 w-12 h-12 bg-[#6D4CFF] text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform"
          >
            {uploading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
          </button>
        </div>

        {/* Main Info */}
        <div className="bg-white rounded-[22px] p-6 shadow-[0_12px_32px_rgba(31,20,70,0.12)] space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-[13px] font-medium text-[#8B849E] mb-1.5 block">Item Name</label>
              <input 
                value={item.item_name}
                onChange={e => setItem({ ...item, item_name: e.target.value })}
                className="w-full text-xl font-bold text-[#17142A] bg-transparent border-b border-transparent focus:border-[#6D4CFF] outline-none pb-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#EEE9FF] flex items-center justify-center text-[#6D4CFF]">
                  <Hash size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-[#8B849E]">Box</p>
                  <select
                    value={item.box_id}
                    onChange={e => setItem({ ...item, box_id: Number(e.target.value) })}
                    className="w-full bg-transparent font-bold text-[#17142A] outline-none"
                  >
                    {boxes.map(box => (
                      <option key={box.id} value={box.id}>
                        {`Box #${box.box_number}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#DDFBF5] flex items-center justify-center text-[#14B8A6]">
                  <Tag size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] text-[#8B849E]">Type</p>
                  <select 
                    value={item.item_type}
                    onChange={e => setItem({ ...item, item_type: e.target.value as ItemType })}
                    className="font-bold text-[#17142A] bg-transparent outline-none w-full appearance-none"
                  >
                    {itemTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FEF3C7] flex items-center justify-center text-[#F59E0B]">
                  <Home size={20} />
                </div>
                <div>
                  <p className="text-[11px] text-[#8B849E]">Room</p>
                  <p className="font-bold text-[#17142A]">{displayedRoom}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FFE4E6] flex items-center justify-center text-[#F43F5E]">
                  <MapPin size={20} />
                </div>
                <div>
                  <p className="text-[11px] text-[#8B849E]">Location</p>
                  <p className="font-bold text-[#17142A]">{displayedLocation}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-[#E6E0F0]" />

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[13px] font-medium text-[#8B849E] mb-1.5 block">Quantity</label>
                <input 
                  type="number"
                  value={item.count}
                  onChange={e => setItem({ ...item, count: parseInt(e.target.value) || 1 })}
                  className="w-full h-12 px-4 rounded-[12px] border border-[#E6E0F0] outline-none"
                />
              </div>
              <div>
                <label className="text-[13px] font-medium text-[#8B849E] mb-1.5 block">Est. Value ($)</label>
                <input 
                  type="number"
                  value={item.est_value || ''}
                  onChange={e => setItem({ ...item, est_value: e.target.value })}
                  className="w-full h-12 px-4 rounded-[12px] border border-[#E6E0F0] outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-[13px] font-medium text-[#8B849E] mb-1.5 block">Description</label>
              <textarea 
                value={item.description || ''}
                onChange={e => setItem({ ...item, description: e.target.value })}
                className="w-full p-4 rounded-[12px] border border-[#E6E0F0] outline-none min-h-[80px]"
              />
            </div>
            <div>
              <label className="text-[13px] font-medium text-[#8B849E] mb-1.5 block">Notes</label>
              <textarea 
                value={item.item_notes || ''}
                onChange={e => setItem({ ...item, item_notes: e.target.value })}
                className="w-full p-4 rounded-[12px] border border-[#E6E0F0] outline-none min-h-[80px]"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={handleDelete}
            className="h-14 bg-white border-2 border-[#F43F5E] text-[#F43F5E] rounded-[16px] font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Trash2 size={20} /> Delete
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="h-14 bg-[#6D4CFF] text-white rounded-[16px] font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Save size={20} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default ItemDetail;