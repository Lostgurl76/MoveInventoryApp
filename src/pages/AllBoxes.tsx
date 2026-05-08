import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { Box, Location } from '@/types/inventory';
import { LocationBadge, getLocationAccent } from '@/components/LocationBadge';
import { Package, ChevronRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';

const AllBoxes = () => {
  const [searchParams] = useSearchParams();
  const initialLocation = searchParams.get('location') as Location | 'All' || 'All';
  
  const [boxes, setBoxes] = useState<any[]>([]);
  const [filter, setFilter] = useState<Location | 'All'>(initialLocation);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBoxes = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('boxes')
        .select('*, items(item_id, count)')
        .order('box_number', { ascending: false });
      
      if (data) {
        const processed = data.map(b => ({
          ...b,
          itemCount: b.items?.reduce((acc: number, curr: any) => acc + (curr.count || 1), 0) || 0
        }));
        setBoxes(processed);
      }
      setLoading(false);
    };

    fetchBoxes();
  }, []);

  const filteredBoxes = filter === 'All' ? boxes : boxes.filter(b => b.location === filter);

  return (
    <Layout title="All Boxes">
      <div className="space-y-6">
        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar sticky top-[72px] z-30 bg-[#F6F4FB]">
          {['All', 'Pod', 'Mae Car', 'Ant Car', 'Unassigned'].map(loc => (
            <button
              key={loc}
              onClick={() => setFilter(loc as any)}
              className={cn(
                "px-5 py-2.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-all shadow-sm",
                filter === loc ? "bg-[#6D4CFF] text-white" : "bg-white text-[#5F5A72]"
              )}
            >
              {loc}
            </button>
          ))}
        </div>

        {/* Box Grid */}
        <div className="grid gap-4">
          {filteredBoxes.map(box => (
            <Link 
              key={box.id}
              to={`/items-by-box?box=${box.box_number}`}
              className="bg-white rounded-[18px] shadow-[0_6px_18px_rgba(31,20,70,0.08)] overflow-hidden flex active:scale-[0.98] transition-transform border-l-4"
              style={{ borderLeftColor: getLocationAccent(box.location) }}
            >
              <div className="p-5 flex-1 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-bold text-[#17142A]">#{box.box_number}</span>
                    <LocationBadge location={box.location} />
                  </div>
                  <p className="text-[15px] font-semibold text-[#5F5A72]">{box.room}</p>
                  <div className="flex items-center gap-1.5 mt-2 text-[12px] text-[#8B849E]">
                    <Package size={14} />
                    <span>{box.itemCount} items</span>
                  </div>
                </div>
                <ChevronRight size={24} className="text-[#E6E0F0]" />
              </div>
            </Link>
          ))}
          {!loading && filteredBoxes.length === 0 && (
            <div className="text-center py-20">
              <Package size={48} className="mx-auto mb-4 text-[#E6E0F0]" />
              <p className="text-[#8B849E]">No boxes found in this location</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AllBoxes;