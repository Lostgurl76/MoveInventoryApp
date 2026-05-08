import { Location } from '@/types/inventory';
import { cn } from '@/lib/utils';

const locationStyles: Record<Location, { accent: string, bg: string, text: string }> = {
  'Pod': { accent: '#F59E0B', bg: '#FEF3C7', text: '#92400E' },
  'Mae Car': { accent: '#6D4CFF', bg: '#EEE9FF', text: '#4B2FBF' },
  'Ant Car': { accent: '#14B8A6', bg: '#DDFBF5', text: '#0F766E' },
  'Unassigned': { accent: '#F43F5E', bg: '#FFE4E6', text: '#9F1239' },
};

export const LocationBadge = ({ location }: { location: Location }) => {
  const style = locationStyles[location];
  return (
    <span 
      className="px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {location}
    </span>
  );
};

export const getLocationAccent = (location: Location) => locationStyles[location].accent;