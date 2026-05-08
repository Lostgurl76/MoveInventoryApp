import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { Item, Box, ItemType } from '@/types/inventory';
import { showSuccess, showError } from '@/utils/toast';
import { Trash2, Save, Package, MapPin, Home, Tag, DollarSign, Hash, FileText } from 'lucide-react';

const ItemDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchItem = async () => {
      const { data } = await supabase
        .from('items')
        .select('*, boxes(*)')
        .eq('item_id', id)
        .single();
      if (data) setItem(data);
      setLoading(false);
    };
    fetchItem();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('items')
        .update({
          item_name: item.item_name,
          count: item.count,
          item_type: item.item_type,
          description: item.description,
          serial_number: item.serial_number,
          est_value: item.est_value,
          item_notes: item.item_notes
        })
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

  return (
    <Layout title="Item Details" showBack>
      <div className="space-y-6">
        {/* Image / Placeholder */}
        <div className="aspect-square bg-white rounded-[22px] shadow-[0_12px_32px_rgba(31,20,70,0.12)] overflow-hidden flex items-center justify-center">
          {item.image ? (
            <img src={item.image} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="text-center space-y-2">
              <Package size={64} className="mx-auto text-[#E6E0F0]" />
              <p className="text-[13px] text-[#8B849E]">No photo added</p>
            </div>
          )}
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
                <div>
                  <p className="text-[11px] text-[#8B849E]">Box</p>
                  <p className="font-bold text-[#17142A]">#{item.boxes?.box_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#DDFBF5] flex items-center justify-center text-[#14B8A6]">
                  <Tag size={20} />
                </div>
                <div>
                  <p className="text-[11px] text-[#8B849E]">Type</p>
                  <p className="font-bold text-[#17142A]">{item.item_type}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FEF3C7] flex items-center justify-center text-[#F59E0B]">
                  <Home size={20} />
                </div>
                <div>
                  <p className="text-[11px] text-[#8B849E]">Room</p>
                  <p className="font-bold text-[#17142A]">{item.room}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FFE4E6] flex items-center justify-center text-[#F43F5E]">
                  <MapPin size={20} />
                </div>
                <div>
                  <p className="text-[11px] text-[#8B849E]">Location</p>
                  <p className="font-bold text-[#17142A]">{item.location}</p>
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