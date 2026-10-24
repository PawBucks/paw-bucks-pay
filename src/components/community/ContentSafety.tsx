import { useState } from 'react';
import { MoreHorizontal, Flag, UserX, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter,DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
export function ContentSafety({id,authorId,target,onChanged,onEdit}:{id:string;authorId:string;target:'post'|'comment'|'tip';onChanged:()=>void;onEdit?:()=>void}) {
 const {user}=useAuth();const [mode,setMode]=useState<'report'|'block'|'delete'|null>(null);const [reason,setReason]=useState('spam');const [details,setDetails]=useState('');const [busy,setBusy]=useState(false);
 if(!user)return null;
 const submit=async()=>{setBusy(true);let error;
 try {if(mode==='report')({error}=await supabase.from('community_reports').insert({reporter_id:user.id,target_type:target,target_id:id,target_author_id:authorId,reason,details}));
 if(mode==='block')({error}=await supabase.from('community_blocks').insert({blocker_id:user.id,blocked_id:authorId}));
 if(mode==='delete')({error}=await supabase.from(target==='post'?'community_posts':target==='comment'?'community_comments':'guide_place_tips').delete().eq('id',id).eq('author_id',user.id));
 if(error)throw error;toast.success(mode==='report'?'Report sent for review':mode==='block'?'Member blocked':'Deleted');setMode(null);onChanged();}catch(e){toast.error(e instanceof Error?e.message:'Could not save this action. You may have already reported this content.')}finally{setBusy(false)}};
 return <><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`${target} options`}><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
 {user.id===authorId?<>{onEdit&&<DropdownMenuItem onSelect={onEdit}><Pencil className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>}<DropdownMenuItem onSelect={()=>setMode('delete')} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem></>:<><DropdownMenuItem onSelect={()=>setMode('report')}><Flag className="mr-2 h-4 w-4"/>Report</DropdownMenuItem><DropdownMenuItem onSelect={()=>setMode('block')}><UserX className="mr-2 h-4 w-4"/>Block member</DropdownMenuItem></>}
 </DropdownMenuContent></DropdownMenu><Dialog open={mode!==null} onOpenChange={v=>{if(!v&&!busy)setMode(null)}}><DialogContent><DialogHeader><DialogTitle>{mode==='report'?'Report content':mode==='block'?'Block this member?':'Delete this content?'}</DialogTitle><DialogDescription>{mode==='report'?'Your report is private and will be reviewed by the PawBucks team.':mode==='block'?"You will no longer see each other's posts, comments, or place tips.":'This cannot be undone.'}</DialogDescription></DialogHeader>{mode==='report'&&<div className="space-y-3"><Label htmlFor="report-reason">Reason</Label><select id="report-reason" className="w-full rounded-md border bg-background p-2" value={reason} onChange={e=>setReason(e.target.value)}>{[['spam','Spam or advertising'],['harassment','Harassment or bullying'],['unsafe','Unsafe or inappropriate'],['misinformation','Incorrect place information'],['other','Other']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><Label htmlFor="report-details">Details (optional)</Label><Textarea id="report-details" maxLength={2000} value={details} onChange={e=>setDetails(e.target.value)}/></div>}<DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setMode(null)}>Cancel</Button><Button variant={mode==='delete'?'destructive':'default'} disabled={busy} onClick={submit}>{busy?'Saving…':mode==='report'?'Send report':mode==='block'?'Block member':'Delete'}</Button></DialogFooter></DialogContent></Dialog></>;
}
