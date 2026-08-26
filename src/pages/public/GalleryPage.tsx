import { useEffect, useState } from 'react';
import { ImageOff, Images } from 'lucide-react';
import { subscribeGalleryConfig } from '../../services/galleryService';
import type { GalleryImage } from '../../types';

export default function GalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [visible, setVisible] = useState(true);

  useEffect(() => subscribeGalleryConfig((config) => { setImages(config.images); setVisible(config.visible); }), []);

  if (!visible) return <div className="min-h-[60vh] grid place-items-center px-4"><div className="text-center"><ImageOff className="w-10 h-10 mx-auto mb-3 text-slate-400" /><h1 className="text-xl font-bold">Gallery is currently private</h1><p className="mt-2 text-sm text-slate-500">Please check back later.</p></div></div>;

  return (
    <div className="py-12 sm:py-16">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-9 sm:mb-12"><div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-xs font-bold text-blue-700"><Images className="w-4 h-4" /> SAInT MOMENTS</div><h1 className="mt-4 text-3xl sm:text-5xl font-black text-slate-900">Gallery</h1><p className="mt-3 text-sm sm:text-base text-slate-600">A glimpse of the workshops, events, and people behind SAInT.</p></div>
        {images.length === 0 ? <div className="card py-16 text-center text-slate-500">Photos will appear here soon.</div> : <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">{images.map((image) => <figure key={image.id} className="break-inside-avoid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><img src={image.url} alt={image.alt || 'SAInT gallery'} className="w-full h-auto object-cover" loading="lazy" /><figcaption className="px-3 py-2 text-xs text-slate-500">{image.alt || 'SAInT event moment'}</figcaption></figure>)}</div>}
      </section>
    </div>
  );
}
