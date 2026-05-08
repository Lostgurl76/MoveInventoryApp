import { supabase } from '@/lib/supabase';

export const uploadItemImage = async (file: File): Promise<string | null> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `items/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('item-images')
    .upload(filePath, file);

  if (uploadError) {
    console.error('Error uploading image:', uploadError);
    return null;
  }

  const { data } = supabase.storage
    .from('item-images')
    .getPublicUrl(filePath);

  return data.publicUrl;
};