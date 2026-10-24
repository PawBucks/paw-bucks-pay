import { useEffect,useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
export function ModerationQueue(){
 const [reports,setReports]=useState<(Database['public']['Tables']['community_reports']['Row']&{content?:string})[]>([]);const [busy,setBusy]=useState('');const [loading,setLoading]=useState(true);
 const load=async()=>{setLoading(true);const {data,error}=await supabase.from('community_reports').select('*').eq('status','open').order('created_at');if(error)toast.error('Could not load reports');else{const rows=await Promise.all((data||[]).map(async r=>{const {data:content}=await supabase.rpc('community_report_content',{report_uuid:r.id});return {...r,content:content||'Content unavailable or already removed'}}));setReports(rows)}setLoading(false)};
 useEffect(()=>{void load()},[]);
 const resolve=async(id:string,action:string)=>{if(action==='remove'&&!confirm('Remove this content from the community?'))return;setBusy(id);const {error}=await supabase.rpc('community_moderate_report',{report_id:id,action});setBusy('');if(error)toast.error(error.message);else{toast.success(action==='remove'?'Content removed':'Report dismissed');void load()}};
 return <section className="space-y-4"><div className="flex items-center justify-between"><h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary"/>Community reports</h2><Button variant="outline" onClick={()=>void load()}>Refresh</Button></div>{loading?<p>Loading reports…</p>:reports.length===0?<p className="text-sm text-muted-foreground">No open reports.</p>:reports.map(r=><article key={r.id} className="border rounded-lg p-4 space-y-3"><div className="font-semibold capitalize">{r.target_type} · {r.reason}</div><p className="text-sm whitespace-pre-wrap break-words">{r.content}</p>{r.details&&<p className="text-sm text-muted-foreground">Reporter details: {r.details}</p>}<p className="text-xs text-muted-foreground">Reported {new Date(r.created_at).toLocaleString('en-US',{timeZone:'America/New_York'})}</p><div className="flex gap-2"><Button variant="destructive" disabled={busy===r.id} onClick={()=>resolve(r.id,'remove')}>Remove content</Button><Button variant="outline" disabled={busy===r.id} onClick={()=>resolve(r.id,'dismiss')}>Dismiss report</Button></div></article>)}</section>
}
