import { useEffect, useState } from'react';
import { supabase } from'@/integrations/supabase/client';
import { Button } from'@/components/ui/button';
import { Input } from'@/components/ui/input';
import { Label } from'@/components/ui/label';
import { Textarea } from'@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from'@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from'@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from'@/components/ui/select';
import { Badge } from'@/components/ui/badge';
import { Plus, Edit, Trash2 } from'lucide-react';
import { toast } from'sonner';

type CMSContent = {
 id: string;
 content_type: string;
 title: string;
 content: any;
 is_active: boolean;
 display_order: number;
 created_at: string;
};

export function CMSTab() {
 const [content, setContent] = useState<CMSContent[]>([]);
 const [editDialogOpen, setEditDialogOpen] = useState(false);
 const [selectedContent, setSelectedContent] = useState<CMSContent | null>(null);
 const [loading, setLoading] = useState(false);

 useEffect(() => {
 loadContent();
 }, []);

 const loadContent = async () => {
 try {
 const { data, error } = await supabase
 .from('cms_content')
 .select('*')
 .order('display_order', { ascending: true });

 if (error) throw error;
 setContent(data || []);
 } catch (error) {
 console.error('Error loading CMS content:', error);
 toast.error('Failed to load content');
 }
 };

 const handleSaveContent = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!selectedContent) return;

 setLoading(true);
 try {
 if (selectedContent.id) {
 const { error } = await supabase
 .from('cms_content')
 .update({
 title: selectedContent.title,
 content: selectedContent.content,
 content_type: selectedContent.content_type,
 is_active: selectedContent.is_active,
 display_order: selectedContent.display_order,
 })
 .eq('id', selectedContent.id);

 if (error) throw error;
 } else {
 const { error } = await supabase
 .from('cms_content')
 .insert([{
 title: selectedContent.title,
 content: selectedContent.content,
 content_type: selectedContent.content_type,
 is_active: selectedContent.is_active,
 display_order: selectedContent.display_order,
 }]);

 if (error) throw error;
 }

 await supabase.rpc('log_admin_action', {
 _action: selectedContent.id ?'UPDATE_CMS' :'CREATE_CMS',
 _entity_type:'cms',
 _entity_id: selectedContent.id,
 _changes: { title: selectedContent.title },
 });

 toast.success('Content saved successfully');
 setEditDialogOpen(false);
 loadContent();
 } catch (error: any) {
 toast.error(error.message);
 } finally {
 setLoading(false);
 }
 };

 const handleDeleteContent = async (id: string) => {
 if (!confirm('Are you sure you want to delete this content?')) return;

 try {
 const { error } = await supabase
 .from('cms_content')
 .delete()
 .eq('id', id);

 if (error) throw error;

 await supabase.rpc('log_admin_action', {
 _action:'DELETE_CMS',
 _entity_type:'cms',
 _entity_id: id,
 _changes: {},
 });

 toast.success('Content deleted');
 loadContent();
 } catch (error: any) {
 toast.error(error.message);
 }
 };

 const newContent = () => {
 setSelectedContent({
 id:'',
 content_type:'banner',
 title:'',
 content: {},
 is_active: true,
 display_order: 0,
 created_at: new Date().toISOString(),
 });
 setEditDialogOpen(true);
 };

 return (
 <div className="space-y-6">
 <div className="flex justify-between items-center">
 <div>
 <h2 className="text-3xl font-bold">Content Management</h2>
 <p className="text-muted-foreground">Manage banners, promotions, and content</p>
 </div>
 <Button onClick={newContent}>
 <Plus className="w-4 h-4 mr-2" />
 Add Content
 </Button>
 </div>

 <div className="border rounded-lg">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Title</TableHead>
 <TableHead>Type</TableHead>
 <TableHead>Order</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Created</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {content.map((item) => (
 <TableRow key={item.id}>
 <TableCell className="font-medium">{item.title}</TableCell>
 <TableCell>
 <Badge variant="outline">{item.content_type}</Badge>
 </TableCell>
 <TableCell>{item.display_order}</TableCell>
 <TableCell>
 <Badge variant={item.is_active ?'default' :'secondary'}>
 {item.is_active ?'Active' :'Inactive'}
 </Badge>
 </TableCell>
 <TableCell>{new Date(item.created_at).toLocaleDateString()}</TableCell>
 <TableCell className="text-right">
 <Button
 variant="ghost"
 size="sm"
 onClick={() => {
 setSelectedContent(item);
 setEditDialogOpen(true);
 }}
 >
 <Edit className="w-4 h-4" />
 </Button>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleDeleteContent(item.id)}
 >
 <Trash2 className="w-4 h-4 text-destructive" />
 </Button>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>

 <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
 <DialogContent className="max-w-2xl">
 <DialogHeader>
 <DialogTitle>{selectedContent?.id ?'Edit Content' :'Add Content'}</DialogTitle>
 <DialogDescription>Manage platform content and promotions</DialogDescription>
 </DialogHeader>
 {selectedContent && (
 <form onSubmit={handleSaveContent} className="space-y-4">
 <div className="space-y-2">
 <Label>Title</Label>
 <Input
 value={selectedContent.title}
 onChange={(e) => setSelectedContent({ ...selectedContent, title: e.target.value })}
 required
 />
 </div>
 <div className="space-y-2">
 <Label>Content Type</Label>
 <Select
 value={selectedContent.content_type}
 onValueChange={(value) => setSelectedContent({ ...selectedContent, content_type: value })}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="banner">Banner</SelectItem>
 <SelectItem value="promotion">Promotion</SelectItem>
 <SelectItem value="announcement">Announcement</SelectItem>
 <SelectItem value="offer">Offer</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label>Content (JSON)</Label>
 <Textarea
 value={JSON.stringify(selectedContent.content, null, 2)}
 onChange={(e) => {
 try {
 const parsed = JSON.parse(e.target.value);
 setSelectedContent({ ...selectedContent, content: parsed });
 } catch (err) {
 // Invalid JSON, ignore
 }
 }}
 rows={6}
 className="font-mono text-sm"
 />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Display Order</Label>
 <Input
 type="number"
 value={selectedContent.display_order}
 onChange={(e) => setSelectedContent({ ...selectedContent, display_order: parseInt(e.target.value) })}
 />
 </div>
 <div className="flex items-end">
 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id="is_active"
 checked={selectedContent.is_active}
 onChange={(e) => setSelectedContent({ ...selectedContent, is_active: e.target.checked })}
 />
 <Label htmlFor="is_active">Active</Label>
 </div>
 </div>
 </div>
 <Button type="submit" disabled={loading} className="w-full">
 {loading ?'Saving...' :'Save Content'}
 </Button>
 </form>
 )}
 </DialogContent>
 </Dialog>
 </div>
 );
}
