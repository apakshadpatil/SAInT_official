import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://csmdlwjmukxeejevyhnw.supabase.co';
const supabaseKey = 'sb_publishable_kyYl2Bfcw0U2ZFsr-7hIsw_45DYmbHE';
const bucket = 'SAINT STRBUCK';

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadFile(filePath, destName) {
  const fileBuffer = fs.readFileSync(filePath);
  const destPath = `test_banners/${destName}`;
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(destPath, fileBuffer, {
      contentType: 'image/png',
      upsert: true,
      cacheControl: '3600',
    });

  if (error) {
    throw new Error(`Upload error: ${error.message}`);
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(destPath);
  return urlData.publicUrl;
}

async function main() {
  console.log('Uploading Banner A...');
  const urlA = await uploadFile(path.resolve('./scratch/banner_a_1920x1080.png'), `banner_a_${Date.now()}.png`);
  console.log('Banner A URL:', urlA);

  console.log('Uploading Banner B...');
  const urlB = await uploadFile(path.resolve('./scratch/banner_b_1280x720.png'), `banner_b_${Date.now()}.png`);
  console.log('Banner B URL:', urlB);

  fs.writeFileSync(path.resolve('./scratch/test_banner_urls.json'), JSON.stringify({ urlA, urlB }, null, 2));
}

main().catch(console.error);
