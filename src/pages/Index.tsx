import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { Location } from '@/types/inventory';
import { LocationBadge, getLocationAccent } from '@/components/LocationBadge';
import { Package, Search, Box as BoxIcon, Plus, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Index = () => {
  const [stats, setStats] = useState({
    totalBoxes: 0,
    totalItems: 0,
    unassignedBoxes: 0,
    byLocation: {} as Record<Location, { boxes: number, items: number }>
  });

  useEffect(() => {
    const fetchStats = async () => {
      const { data: boxes } = await supabase.from('boxes').select('id, location');
      const { data: items } = await supabase.from('items').select('item_id, location');
      const unassignedBoxes = boxes?.filter(b => b.location === 'Unassigned').length || 0;

      const locations: Location[] = ['Pod', 'Mae Car', 'Ant Car', 'Unassigned'];
      const byLoc = {} as Record<Location, { boxes: number, items: number }>;
      
      locations.forEach(loc => {
        byLoc[loc] = {
          boxes: boxes?.filter(b => b.location === loc).length || 0,
          items: items?.filter(i => i.location === loc).length || 0
        };
      });

      setStats({
        totalBoxes: boxes?.length || 0,
        totalItems: items?.length || 0,
        unassignedBoxes,
        byLocation: byLoc
      });
    };

    fetchStats();
  }, []);

  return (
    <Layout title="Move Inventory">
      <div className="space-y-6">
        {/* Hero Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-[22px] shadow-[0_12px_32px_rgba(31,20,70,0.12)] text-center">
            <p className="text-[13px] font-medium text-[#8B849E] mb-1">Boxes</p>
            <p className="text-3xl font-bold text-[#17142A]">{stats.totalBoxes}</p>
          </div>
          <div className="bg-white p-5 rounded-[22px] shadow-[0_12px_32px_rgba(31,20,70,0.12)] text-center">
            <p className="text-[13px] font-medium text-[#8B849E] mb-1">Items</p>
            <p className="text-3xl font-bold text-[#17142A]">{stats.totalItems}</p>
          </div>
          <div className="bg-white p-5 rounded-[22px] shadow-[0_12px_32px_rgba(31,20,70,0.12)] text-center">
            <p className="text-[13px] font-medium text-[#8B849E] mb-1">Unassigned</p>
            <p className="text-3xl font-bold text-[#17142A]">{stats.unassignedBoxes}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-3">
          <Link to="/pack" className="flex flex-col items-center gap-2 p-4 bg-white rounded-[18px] shadow-[0_6px_18px_rgba(31,20,70,0.08)] active:scale-95 transition-transform">
            <div className="w-10 h-10 rounded-full bg-[#EEE9FF] flex items-center justify-center text-[#6D4CFF]">
              <Plus size={20} />
            </div>
            <span className="text-[11px] font-semibold text-[#4B2FBF]">Pack</span>
          </Link>
          <Link to="/scan" className="flex flex-col items-center gap-2 p-4 bg-white rounded-[18px] shadow-[0_6px_18px_rgba(31,20,70,0.08)] active:scale-95 transition-transform">
            <div className="w-10 h-10 rounded-full bg-[#F1EFF8] flex items-center justify-center text-[#6D4CFF]">
              <Camera size={20} />
            </div>
            <span className="text-[11px] font-semibold text-[#4B2FBF]">Scan</span>
          </Link>
          <Link to="/find-item" className="flex flex-col items-center gap-2 p-4 bg-white rounded-[18px] shadow-[0_6px_18px_rgba(31,20,70,0.08)] active:scale-95 transition-transform">
            <div className="w-10 h-10 rounded-full bg-[#DDFBF5] flex items-center justify-center text-[#14B8A6]">
              <Search size={20} />
            </div>
            <span className="text-[11px] font-semibold text-[#0F766E]">Find</span>
          </Link>
          <Link to="/all-boxes" className="flex flex-col items-center gap-2 p-4 bg-white rounded-[18px] shadow-[0_6px_18px_rgba(31,20,70,0.08)] active:scale-95 transition-transform">
            <div className="w-10 h-10 rounded-full bg-[#FFE4E6] flex items-center justify-center text-[#F43F5E]">
              <BoxIcon size={20} />
            </div>
            <span className="text-[11px] font-semibold text-[#9F1239]">Boxes</span>
          </Link>
        </div>

        {/* Location Breakdown */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[#17142A] px-1">Locations</h2>
          <div className="grid gap-3">
            {(Object.entries(stats.byLocation) as [Location, { boxes: number, items: number }][]).map(([loc, data]) => (
              <Link 
                key={loc}
                to={`/all-boxes?location=${encodeURIComponent(loc)}`}
                className="block active:scale-[0.98] transition-transform"
              >
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-4 rounded-[18px] shadow-[0_6px_18px_rgba(31,20,70,0.08)] flex items-center justify-between border-l-4"
                  style={{ borderLeftColor: getLocationAccent(loc) }}
                >
                  <div>
                    <p className="font-semibold text-[#17142A]">{loc}</p>
                    <p className="text-[13px] text-[#8B849E]">{data.boxes} boxes • {data.items} items</p>
                  </div>
                  <LocationBadge location={loc} />
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Index;