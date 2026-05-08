import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { Item, Location, ItemType, Room } from '@/types/inventory';
import { Search, Filter, ChevronRight, Package, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const FindItem = () => {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    location: '' as Location | '',
    item_type: '' as ItemType | '',
    room: '' as Room | ''
  });

  useEffect(() => {
    const searchItems = async () => {
      setLoading(true);
      let q = supabase
        .from('items')
        .select('*, boxes(box_number)')
        .ilike('item_name', `%${query}%`);

      if (filters.location) q = q.eq('location', filters.location);
      if (filters.item_type) q = q.eq('item_type', filters.item_type);
      if (filters.room) q = q.eq('room', filters.room);

      const { data } = await q.order('item_name').limit(50);
      setItems(data || []);
      setLoading(false);
    };

    const timer = setTimeout(searchItems, 300);
    return () => clearTimeout(timer);
  }, [query, filters]);

  return (
    <Layout title="Find Item">
      <div className="space-y-6">
        {/* Search Bar */}
        <div className="sticky top-[72px] z-30 bg-[#F6F4FB] pb-2">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B849E]" size={20} />
            <input 
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search items..."
              className="w-full h-14 pl-12 pr-4 bg-white rounded-[16px] shadow-[0_6px_18px_rgba(31,20,70,0.08)] outline-none focus:ring-2 focus:ring-[#6D4CFF]/20"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {['Pod', 'Mae Car', 'Ant Car', 'Unassigned'].map(loc => (
              <button
                key={loc}
                onClick={() => setFilters(f => ({ ...f, location: f.location === loc ? '' : loc as Location }))}
                className={cn(
                  "px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors",
                  filters.location === loc ? "bg-[#6D4CFF] text-white" : "bg-white text-[#5F5A72] shadow-sm"
                )}
              >
                {loc}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {['Clothing', 'Kitchenware', 'Electronics', 'Books', 'Furniture', 'Other'].map(type => (
              <button
                key={type}
                onClick={() => setFilters(f => ({ ...f, item_type: f.item_type === type ? '' : type as ItemType }))}
                className={cn(
                  "px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors",
                  filters.item_type === type ? "bg-[#14B8A6] text-white" : "bg-white text-[#5F5A72] shadow-sm"
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="space-y-3">
          <p className="text-[13px] font-medium text-[#8B849E] px-1">
            {loading ? 'Searching...' : `${items.length} items found`}
          </p>
          <div className="grid gap-3">
            {items.map(item => (
              <Link 
                key={item.item_id}
                to={`/item-detail/${item.item_id}`}
                className="bg-white p-4 rounded-[18px] shadow-[0_6px_18px_rgba(31,20,70,0.08)] flex items-center justify-between active:scale-[0.98] transition-transform"
              >
                <div className="flex-1">
                  <p className="font-semibold text-[#17142A]">{item.item_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-bold text-[#6D4CFF] bg-[#EEE9FF] px-2 py-0.5 rounded">BOX #{item.boxes?.box_number}</span>
                    <span className="text-[12px] text-[#8B849E]">{item.room} • {item.location}</span>
                  </div>
                </div>
                <ChevronRight size={20} className="text-[#E6E0F0]" />
              </Link>
            ))}
            {!loading && items.length === 0 && (
              <div className="text-center py-20">
                <Search size={48} className="mx-auto mb-4 text-[#E6E0F0]" />
                <p className="text-[#8B849E]">No items match your search</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default FindItem;