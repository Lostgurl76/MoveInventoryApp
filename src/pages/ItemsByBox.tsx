import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { Box, Item } from '@/types/inventory';
import { LocationBadge } from '@/components/LocationBadge';
import { Package, ChevronRight, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

const ItemsByBox = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const boxNumber = searchParams.get('box');
  const [box, setBox] = useState<Box | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!boxNumber) return;
      setLoading(true);
      
      const { data: boxData } = await supabase
        .from('boxes')
        .select('*')
        .eq('box_number', boxNumber)
        .single();

      if (boxData) {
        setBox(boxData);
        const { data: itemsData } = await supabase
          .from('items')
          .select('*')
          .eq('box_id', boxData.id)
          .order('item_id', { ascending: false });
        setItems(itemsData || []);
      }
      setLoading(false);
    };

    fetchData();
  }, [boxNumber]);

  if (loading) return <Layout title="Loading..."><div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6D4CFF]"></div></div></Layout>;
  if (!box) return <Layout title="Not Found" showBack><div className="text-center py-20 text-[#8B849E]">Box not found</div></Layout>;

  return (
    <Layout title={`Box #${box.box_number}`} showBack>
      <div className="space-y-6">
        <div className="bg-white rounded-[22px] p-6 shadow-[0_12px_32px_rgba(31,20,70,0.12)]">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-2xl font-bold text-[#17142A]">{box.room}</h2>
            <LocationBadge location={box.location} />
          </div>
          {box.box_label && <p className="text-[13px] text-[#8B849E] italic mb-4">{box.box_label}</p>}
          <div className="flex items-center gap-2 text-[13px] text-[#8B849E]">
            <Package size={16} />
            <span>{items.length} items total</span>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-[15px] font-bold text-[#17142A] px-1">Contents</h3>
          <div className="grid gap-3">
            {items.map(item => (
              <Link 
                key={item.item_id} 
                to={`/item-detail/${item.item_id}`}
                className="bg-white p-4 rounded-[18px] shadow-[0_6px_18px_rgba(31,20,70,0.08)] flex items-center justify-between active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-4">
                  {item.image ? (
                    <img src={item.image} className="w-12 h-12 rounded-xl object-cover" alt="" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-[#F1EFF8] flex items-center justify-center text-[#8B849E]">
                      <Package size={20} />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-[#17142A]">{item.item_name}</p>
                    <p className="text-[12px] text-[#8B849E]">{item.count}x • {item.item_type}</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-[#E6E0F0]" />
              </Link>
            ))}
            {items.length === 0 && (
              <div className="text-center py-12 bg-white rounded-[18px] border-2 border-dashed border-[#E6E0F0]">
                <p className="text-[#8B849E] text-[13px]">This box is empty</p>
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={() => {
            localStorage.setItem('active_box_session', JSON.stringify({
              id: box.id,
              box_number: box.box_number,
              room: box.room,
              location: box.location,
              label_value: box.qr_code_value,
              label_status: 'PRINTED_CONFIRMED',
              item_count: items.length,
              created_at: new Date().toISOString(),
              box_label: box.box_label
            }));
            navigate('/pack');
          }}
          className="w-full h-14 bg-[#6D4CFF] text-white rounded-[16px] font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <Plus size={20} /> Add Item to this Box
        </button>
      </div>
    </Layout>
  );
};

export default ItemsByBox;