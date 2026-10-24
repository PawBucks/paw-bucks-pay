import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
export function CommunityMedia({path,url,type='image'}:{path?:string|null;url?:string|null;type?:string|null}) {
 const [src,setSrc]=useState(url || '');
 useEffect(()=>{let active=true; if(path) supabase.storage.from('community-media').createSignedUrl(path,300).then(({data})=>{if(active)setSrc(data?.signedUrl || '')});return()=>{active=false}},[path]);
 if(!src)return null;
 return type==='video'?<video className="w-full max-h-[520px] bg-muted object-contain" src={src} controls playsInline preload="metadata"/>:<img className="w-full max-h-[520px] object-contain bg-muted" src={src} alt="Community pet photo" loading="lazy"/>;
}
