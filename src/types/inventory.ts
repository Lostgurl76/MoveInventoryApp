export type Location = 'Pod' | 'Mae Car' | 'Ant Car' | 'Unassigned';
export type Room = 'Bathroom' | 'Bedroom' | 'Dining' | 'Garage' | 'General' | 'Hobby' | 'Living Room' | 'Kitchen' | 'Office' | 'Pantry' | 'Patio' | 'Puppers' | 'Storage';
export type ItemType = 'Clothing' | 'Kitchenware' | 'Cookware' | 'Electronics' | 'Books' | 'Furniture' | 'Bedding' | 'Tools' | 'Bathroom' | 'Documents' | 'Décor' | 'Art' | 'Jewelry' | 'Toys' | 'Sports Equipment' | 'Food' | 'Cleaning Supplies' | 'Other';

export type LabelStatus = 'NOT_PRINTED' | 'COPIED' | 'SHARED' | 'PRINTED_CONFIRMED' | 'SKIPPED';

export interface Box {
  id: number;
  box_number: number;
  room: Room;
  location: Location;
  qr_code_value: string;
}

export interface Item {
  item_id: number;
  item_name: string;
  description?: string;
  serial_number?: string;
  count: number;
  est_value?: number;
  item_notes?: string;
  item_type: ItemType;
  image?: string;
  box_id: number;
  location: Location;
  room: Room;
}

export interface ActiveBoxSession {
  id: number;
  box_number: number;
  room: Room;
  location: Location;
  label_value: string;
  label_status: LabelStatus;
  item_count: number;
  created_at: string;
}

export type AppState = 
  | 'NO_ACTIVE_BOX'
  | 'ACTIVE_BOX_LABEL_PENDING'
  | 'ACTIVE_BOX_LABEL_CONFIRMED'
  | 'ACTIVE_BOX_ADDING_ITEMS'
  | 'ACTIVE_BOX_COMPLETE';