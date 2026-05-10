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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from'@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from'@/components/ui/tabs';
import { Switch } from'@/components/ui/switch';
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { toast } from'sonner';

type Module = {
 id: string;
 title: string;
 description: string | null;
 display_order: number;
 is_active: boolean;
 created_at: string;
};

type Lesson = {
 id: string;
 module_id: string;
 title: string;
 description: string | null;
 duration_minutes: number;
 video_url: string | null;
 display_order: number;
 is_active: boolean;
 created_at: string;
};

type Resource = {
 id: string;
 title: string;
 description: string | null;
 resource_type:'pdf' |'template' |'checklist' |'guide';
 download_url: string | null;
 display_order: number;
 is_active: boolean;
 created_at: string;
};

export function TrainingCourseManagementTab() {
 const [modules, setModules] = useState<Module[]>([]);
 const [lessons, setLessons] = useState<Lesson[]>([]);
 const [resources, setResources] = useState<Resource[]>([]);
 const [loading, setLoading] = useState(true);
 
 // Dialog states
 const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
 const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
 const [resourceDialogOpen, setResourceDialogOpen] = useState(false);
 
 // Selected items for editing
 const [selectedModule, setSelectedModule] = useState<Module | null>(null);
 const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
 const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
 
 const [saving, setSaving] = useState(false);

 useEffect(() => {
 loadAllData();
 }, []);

 const loadAllData = async () => {
 setLoading(true);
 try {
 const [modulesRes, lessonsRes, resourcesRes] = await Promise.all([
 supabase.from('training_course_modules').select('*').order('display_order'),
 supabase.from('training_course_lessons').select('*').order('display_order'),
 supabase.from('training_course_resources').select('*').order('display_order'),
 ]);

 if (modulesRes.error) throw modulesRes.error;
 if (lessonsRes.error) throw lessonsRes.error;
 if (resourcesRes.error) throw resourcesRes.error;

 setModules(modulesRes.data || []);
 setLessons(lessonsRes.data || []);
 setResources((resourcesRes.data || []).map(r => ({
 ...r,
 resource_type: r.resource_type as'pdf' |'template' |'checklist' |'guide'
 })));
 } catch (error) {
 console.error('Error loading training content:', error);
 toast.error('Failed to load training content');
 } finally {
 setLoading(false);
 }
 };

 // Module CRUD
 const handleSaveModule = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!selectedModule) return;
 setSaving(true);

 try {
 if (selectedModule.id) {
 const { error } = await supabase
 .from('training_course_modules')
 .update({
 title: selectedModule.title,
 description: selectedModule.description,
 display_order: selectedModule.display_order,
 is_active: selectedModule.is_active,
 })
 .eq('id', selectedModule.id);
 if (error) throw error;
 } else {
 const { error } = await supabase
 .from('training_course_modules')
 .insert([{
 title: selectedModule.title,
 description: selectedModule.description,
 display_order: selectedModule.display_order,
 is_active: selectedModule.is_active,
 }]);
 if (error) throw error;
 }

 await supabase.rpc('log_admin_action', {
 _action: selectedModule.id ?'UPDATE_TRAINING_MODULE' :'CREATE_TRAINING_MODULE',
 _entity_type:'training_module',
 _entity_id: selectedModule.id || null,
 _changes: { title: selectedModule.title },
 });

 toast.success('Module saved successfully');
 setModuleDialogOpen(false);
 loadAllData();
 } catch (error: any) {
 toast.error(error.message);
 } finally {
 setSaving(false);
 }
 };

 const handleDeleteModule = async (id: string) => {
 if (!confirm('Are you sure? This will also delete all lessons in this module.')) return;

 try {
 const { error } = await supabase.from('training_course_modules').delete().eq('id', id);
 if (error) throw error;

 await supabase.rpc('log_admin_action', {
 _action:'DELETE_TRAINING_MODULE',
 _entity_type:'training_module',
 _entity_id: id,
 _changes: {},
 });

 toast.success('Module deleted');
 loadAllData();
 } catch (error: any) {
 toast.error(error.message);
 }
 };

 // Lesson CRUD
 const handleSaveLesson = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!selectedLesson) return;
 setSaving(true);

 try {
 if (selectedLesson.id) {
 const { error } = await supabase
 .from('training_course_lessons')
 .update({
 module_id: selectedLesson.module_id,
 title: selectedLesson.title,
 description: selectedLesson.description,
 duration_minutes: selectedLesson.duration_minutes,
 video_url: selectedLesson.video_url,
 display_order: selectedLesson.display_order,
 is_active: selectedLesson.is_active,
 })
 .eq('id', selectedLesson.id);
 if (error) throw error;
 } else {
 const { error } = await supabase
 .from('training_course_lessons')
 .insert([{
 module_id: selectedLesson.module_id,
 title: selectedLesson.title,
 description: selectedLesson.description,
 duration_minutes: selectedLesson.duration_minutes,
 video_url: selectedLesson.video_url,
 display_order: selectedLesson.display_order,
 is_active: selectedLesson.is_active,
 }]);
 if (error) throw error;
 }

 await supabase.rpc('log_admin_action', {
 _action: selectedLesson.id ?'UPDATE_TRAINING_LESSON' :'CREATE_TRAINING_LESSON',
 _entity_type:'training_lesson',
 _entity_id: selectedLesson.id || null,
 _changes: { title: selectedLesson.title },
 });

 toast.success('Lesson saved successfully');
 setLessonDialogOpen(false);
 loadAllData();
 } catch (error: any) {
 toast.error(error.message);
 } finally {
 setSaving(false);
 }
 };

 const handleDeleteLesson = async (id: string) => {
 if (!confirm('Are you sure you want to delete this lesson?')) return;

 try {
 const { error } = await supabase.from('training_course_lessons').delete().eq('id', id);
 if (error) throw error;

 await supabase.rpc('log_admin_action', {
 _action:'DELETE_TRAINING_LESSON',
 _entity_type:'training_lesson',
 _entity_id: id,
 _changes: {},
 });

 toast.success('Lesson deleted');
 loadAllData();
 } catch (error: any) {
 toast.error(error.message);
 }
 };

 // Resource CRUD
 const handleSaveResource = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!selectedResource) return;
 setSaving(true);

 try {
 if (selectedResource.id) {
 const { error } = await supabase
 .from('training_course_resources')
 .update({
 title: selectedResource.title,
 description: selectedResource.description,
 resource_type: selectedResource.resource_type,
 download_url: selectedResource.download_url,
 display_order: selectedResource.display_order,
 is_active: selectedResource.is_active,
 })
 .eq('id', selectedResource.id);
 if (error) throw error;
 } else {
 const { error } = await supabase
 .from('training_course_resources')
 .insert([{
 title: selectedResource.title,
 description: selectedResource.description,
 resource_type: selectedResource.resource_type,
 download_url: selectedResource.download_url,
 display_order: selectedResource.display_order,
 is_active: selectedResource.is_active,
 }]);
 if (error) throw error;
 }

 await supabase.rpc('log_admin_action', {
 _action: selectedResource.id ?'UPDATE_TRAINING_RESOURCE' :'CREATE_TRAINING_RESOURCE',
 _entity_type:'training_resource',
 _entity_id: selectedResource.id || null,
 _changes: { title: selectedResource.title },
 });

 toast.success('Resource saved successfully');
 setResourceDialogOpen(false);
 loadAllData();
 } catch (error: any) {
 toast.error(error.message);
 } finally {
 setSaving(false);
 }
 };

 const handleDeleteResource = async (id: string) => {
 if (!confirm('Are you sure you want to delete this resource?')) return;

 try {
 const { error } = await supabase.from('training_course_resources').delete().eq('id', id);
 if (error) throw error;

 await supabase.rpc('log_admin_action', {
 _action:'DELETE_TRAINING_RESOURCE',
 _entity_type:'training_resource',
 _entity_id: id,
 _changes: {},
 });

 toast.success('Resource deleted');
 loadAllData();
 } catch (error: any) {
 toast.error(error.message);
 }
 };

 // Helper functions
 const newModule = () => {
 setSelectedModule({
 id:'',
 title:'',
 description:'',
 display_order: modules.length + 1,
 is_active: true,
 created_at: new Date().toISOString(),
 });
 setModuleDialogOpen(true);
 };

 const newLesson = () => {
 setSelectedLesson({
 id:'',
 module_id: modules[0]?.id ||'',
 title:'',
 description:'',
 duration_minutes: 10,
 video_url: null,
 display_order: lessons.length + 1,
 is_active: true,
 created_at: new Date().toISOString(),
 });
 setLessonDialogOpen(true);
 };

 const newResource = () => {
 setSelectedResource({
 id:'',
 title:'',
 description:'',
 resource_type:'guide',
 download_url: null,
 display_order: resources.length + 1,
 is_active: true,
 created_at: new Date().toISOString(),
 });
 setResourceDialogOpen(true);
 };

 const getModuleName = (moduleId: string) => {
 return modules.find(m => m.id === moduleId)?.title ||'Unknown Module';
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="h-8 w-8 animate-spin text-primary" />
 </div>
 );
 }

 return (
 <div className="space-y-6">
 <div className="flex justify-between items-center">
 <div>
 <h2 className="text-3xl font-bold flex items-center gap-2">
 <span className="h-8 w-8" aria-hidden="true">🎓</span>
 Training Course Management
 </h2>
 <p className="text-muted-foreground">Manage modules, lessons, and resources for the Exclusive Training Course</p>
 </div>
 </div>

 {/* Stats Cards */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">Modules</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{modules.filter(m => m.is_active).length}</div>
 <p className="text-xs text-muted-foreground">{modules.length} total</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">Lessons</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{lessons.filter(l => l.is_active).length}</div>
 <p className="text-xs text-muted-foreground">{lessons.length} total</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">Resources</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{resources.filter(r => r.is_active).length}</div>
 <p className="text-xs text-muted-foreground">{resources.length} total</p>
 </CardContent>
 </Card>
 </div>

 <Tabs defaultValue="modules" className="w-full">
 <TabsList>
 <TabsTrigger value="modules" className="gap-2">
 <span className="h-4 w-4" aria-hidden="true">📖</span> Modules
 </TabsTrigger>
 <TabsTrigger value="lessons" className="gap-2">
 <span className="h-4 w-4" aria-hidden="true">🎓</span> Lessons
 </TabsTrigger>
 <TabsTrigger value="resources" className="gap-2">
 <span className="h-4 w-4" aria-hidden="true">📄</span> Resources
 </TabsTrigger>
 </TabsList>

 {/* Modules Tab */}
 <TabsContent value="modules" className="space-y-4">
 <div className="flex justify-end">
 <Button onClick={newModule}>
 <Plus className="w-4 h-4 mr-2" />
 Add Module
 </Button>
 </div>
 <div className="border rounded-lg">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Order</TableHead>
 <TableHead>Title</TableHead>
 <TableHead>Description</TableHead>
 <TableHead>Lessons</TableHead>
 <TableHead>Status</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {modules.map((module) => (
 <TableRow key={module.id}>
 <TableCell>{module.display_order}</TableCell>
 <TableCell className="font-medium">{module.title}</TableCell>
 <TableCell className="max-w-[200px] truncate">{module.description}</TableCell>
 <TableCell>{lessons.filter(l => l.module_id === module.id).length}</TableCell>
 <TableCell>
 <Badge variant={module.is_active ?'default' :'secondary'}>
 {module.is_active ?'Active' :'Inactive'}
 </Badge>
 </TableCell>
 <TableCell className="text-right">
 <Button variant="ghost" size="sm" onClick={() => { setSelectedModule(module); setModuleDialogOpen(true); }}>
 <Edit className="w-4 h-4" />
 </Button>
 <Button variant="ghost" size="sm" onClick={() => handleDeleteModule(module.id)}>
 <Trash2 className="w-4 h-4 text-destructive" />
 </Button>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 </TabsContent>

 {/* Lessons Tab */}
 <TabsContent value="lessons" className="space-y-4">
 <div className="flex justify-end">
 <Button onClick={newLesson} disabled={modules.length === 0}>
 <Plus className="w-4 h-4 mr-2" />
 Add Lesson
 </Button>
 </div>
 <div className="border rounded-lg">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Order</TableHead>
 <TableHead>Module</TableHead>
 <TableHead>Title</TableHead>
 <TableHead>Duration</TableHead>
 <TableHead>Video</TableHead>
 <TableHead>Status</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {lessons.map((lesson) => (
 <TableRow key={lesson.id}>
 <TableCell>{lesson.display_order}</TableCell>
 <TableCell>
 <Badge variant="outline">{getModuleName(lesson.module_id)}</Badge>
 </TableCell>
 <TableCell className="font-medium">{lesson.title}</TableCell>
 <TableCell>{lesson.duration_minutes} min</TableCell>
 <TableCell>
 <Badge variant={lesson.video_url ?'default' :'secondary'}>
 {lesson.video_url ?'Has Video' :'No Video'}
 </Badge>
 </TableCell>
 <TableCell>
 <Badge variant={lesson.is_active ?'default' :'secondary'}>
 {lesson.is_active ?'Active' :'Inactive'}
 </Badge>
 </TableCell>
 <TableCell className="text-right">
 <Button variant="ghost" size="sm" onClick={() => { setSelectedLesson(lesson); setLessonDialogOpen(true); }}>
 <Edit className="w-4 h-4" />
 </Button>
 <Button variant="ghost" size="sm" onClick={() => handleDeleteLesson(lesson.id)}>
 <Trash2 className="w-4 h-4 text-destructive" />
 </Button>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 </TabsContent>

 {/* Resources Tab */}
 <TabsContent value="resources" className="space-y-4">
 <div className="flex justify-end">
 <Button onClick={newResource}>
 <Plus className="w-4 h-4 mr-2" />
 Add Resource
 </Button>
 </div>
 <div className="border rounded-lg">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Order</TableHead>
 <TableHead>Title</TableHead>
 <TableHead>Type</TableHead>
 <TableHead>Download URL</TableHead>
 <TableHead>Status</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {resources.map((resource) => (
 <TableRow key={resource.id}>
 <TableCell>{resource.display_order}</TableCell>
 <TableCell className="font-medium">{resource.title}</TableCell>
 <TableCell>
 <Badge variant="outline" className="capitalize">{resource.resource_type}</Badge>
 </TableCell>
 <TableCell className="max-w-[150px] truncate">{resource.download_url ||'-'}</TableCell>
 <TableCell>
 <Badge variant={resource.is_active ?'default' :'secondary'}>
 {resource.is_active ?'Active' :'Inactive'}
 </Badge>
 </TableCell>
 <TableCell className="text-right">
 <Button variant="ghost" size="sm" onClick={() => { setSelectedResource(resource); setResourceDialogOpen(true); }}>
 <Edit className="w-4 h-4" />
 </Button>
 <Button variant="ghost" size="sm" onClick={() => handleDeleteResource(resource.id)}>
 <Trash2 className="w-4 h-4 text-destructive" />
 </Button>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 </TabsContent>
 </Tabs>

 {/* Module Dialog */}
 <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>{selectedModule?.id ?'Edit Module' :'Add Module'}</DialogTitle>
 <DialogDescription>Manage training course modules</DialogDescription>
 </DialogHeader>
 {selectedModule && (
 <form onSubmit={handleSaveModule} className="space-y-4">
 <div className="space-y-2">
 <Label>Title</Label>
 <Input
 value={selectedModule.title}
 onChange={(e) => setSelectedModule({ ...selectedModule, title: e.target.value })}
 required
 />
 </div>
 <div className="space-y-2">
 <Label>Description</Label>
 <Textarea
 value={selectedModule.description ||''}
 onChange={(e) => setSelectedModule({ ...selectedModule, description: e.target.value })}
 rows={3}
 />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Display Order</Label>
 <Input
 type="number"
 value={selectedModule.display_order}
 onChange={(e) => setSelectedModule({ ...selectedModule, display_order: parseInt(e.target.value) })}
 />
 </div>
 <div className="flex items-end">
 <div className="flex items-center gap-2">
 <Switch
 id="module_active"
 checked={selectedModule.is_active}
 onCheckedChange={(checked) => setSelectedModule({ ...selectedModule, is_active: checked })}
 />
 <Label htmlFor="module_active">Active</Label>
 </div>
 </div>
 </div>
 <Button type="submit" disabled={saving} className="w-full">
 {saving ?'Saving...' :'Save Module'}
 </Button>
 </form>
 )}
 </DialogContent>
 </Dialog>

 {/* Lesson Dialog */}
 <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
 <DialogContent className="max-w-lg">
 <DialogHeader>
 <DialogTitle>{selectedLesson?.id ?'Edit Lesson' :'Add Lesson'}</DialogTitle>
 <DialogDescription>Manage training course lessons</DialogDescription>
 </DialogHeader>
 {selectedLesson && (
 <form onSubmit={handleSaveLesson} className="space-y-4">
 <div className="space-y-2">
 <Label>Module</Label>
 <Select
 value={selectedLesson.module_id}
 onValueChange={(value) => setSelectedLesson({ ...selectedLesson, module_id: value })}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select a module" />
 </SelectTrigger>
 <SelectContent>
 {modules.map((module) => (
 <SelectItem key={module.id} value={module.id}>{module.title}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label>Title</Label>
 <Input
 value={selectedLesson.title}
 onChange={(e) => setSelectedLesson({ ...selectedLesson, title: e.target.value })}
 required
 />
 </div>
 <div className="space-y-2">
 <Label>Description</Label>
 <Textarea
 value={selectedLesson.description ||''}
 onChange={(e) => setSelectedLesson({ ...selectedLesson, description: e.target.value })}
 rows={3}
 />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Duration (minutes)</Label>
 <Input
 type="number"
 value={selectedLesson.duration_minutes}
 onChange={(e) => setSelectedLesson({ ...selectedLesson, duration_minutes: parseInt(e.target.value) })}
 />
 </div>
 <div className="space-y-2">
 <Label>Display Order</Label>
 <Input
 type="number"
 value={selectedLesson.display_order}
 onChange={(e) => setSelectedLesson({ ...selectedLesson, display_order: parseInt(e.target.value) })}
 />
 </div>
 </div>
 <div className="space-y-2">
 <Label>Video URL (optional)</Label>
 <Input
 value={selectedLesson.video_url ||''}
 onChange={(e) => setSelectedLesson({ ...selectedLesson, video_url: e.target.value || null })}
 placeholder="https://youtube.com/embed/..."
 />
 </div>
 <div className="flex items-center gap-2">
 <Switch
 id="lesson_active"
 checked={selectedLesson.is_active}
 onCheckedChange={(checked) => setSelectedLesson({ ...selectedLesson, is_active: checked })}
 />
 <Label htmlFor="lesson_active">Active</Label>
 </div>
 <Button type="submit" disabled={saving} className="w-full">
 {saving ?'Saving...' :'Save Lesson'}
 </Button>
 </form>
 )}
 </DialogContent>
 </Dialog>

 {/* Resource Dialog */}
 <Dialog open={resourceDialogOpen} onOpenChange={setResourceDialogOpen}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>{selectedResource?.id ?'Edit Resource' :'Add Resource'}</DialogTitle>
 <DialogDescription>Manage training course resources</DialogDescription>
 </DialogHeader>
 {selectedResource && (
 <form onSubmit={handleSaveResource} className="space-y-4">
 <div className="space-y-2">
 <Label>Title</Label>
 <Input
 value={selectedResource.title}
 onChange={(e) => setSelectedResource({ ...selectedResource, title: e.target.value })}
 required
 />
 </div>
 <div className="space-y-2">
 <Label>Description</Label>
 <Textarea
 value={selectedResource.description ||''}
 onChange={(e) => setSelectedResource({ ...selectedResource, description: e.target.value })}
 rows={3}
 />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Type</Label>
 <Select
 value={selectedResource.resource_type}
 onValueChange={(value:'pdf' |'template' |'checklist' |'guide') => 
 setSelectedResource({ ...selectedResource, resource_type: value })
 }
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="pdf">PDF</SelectItem>
 <SelectItem value="template">Template</SelectItem>
 <SelectItem value="checklist">Checklist</SelectItem>
 <SelectItem value="guide">Guide</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label>Display Order</Label>
 <Input
 type="number"
 value={selectedResource.display_order}
 onChange={(e) => setSelectedResource({ ...selectedResource, display_order: parseInt(e.target.value) })}
 />
 </div>
 </div>
 <div className="space-y-2">
 <Label>Download URL</Label>
 <Input
 value={selectedResource.download_url ||''}
 onChange={(e) => setSelectedResource({ ...selectedResource, download_url: e.target.value || null })}
 placeholder="https://..."
 />
 </div>
 <div className="flex items-center gap-2">
 <Switch
 id="resource_active"
 checked={selectedResource.is_active}
 onCheckedChange={(checked) => setSelectedResource({ ...selectedResource, is_active: checked })}
 />
 <Label htmlFor="resource_active">Active</Label>
 </div>
 <Button type="submit" disabled={saving} className="w-full">
 {saving ?'Saving...' :'Save Resource'}
 </Button>
 </form>
 )}
 </DialogContent>
 </Dialog>
 </div>
 );
}
