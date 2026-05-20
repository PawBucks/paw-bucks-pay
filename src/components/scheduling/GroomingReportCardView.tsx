import { useState, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Separator } from"@/components/ui/separator";
import { FileText, Heart, Image, Lightbulb, Loader2, Scissors } from "lucide-react";
import { PawBucksLogo } from "@/components/PawBucksLogo";
import {
  Dialog,
  DialogContent,
} from"@/components/ui/dialog";

interface GroomingReportCardViewProps {
 bookingId: string;
}

export function GroomingReportCardView({ bookingId }: GroomingReportCardViewProps) {
 const [report, setReport] = useState<any>(null);
 const [photos, setPhotos] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
 const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

 useEffect(() => {
 loadReport();
 }, [bookingId]);

 const loadReport = async () => {
 const { data, error } = await supabase
 .from("grooming_report_cards")
 .select("*, grooming_report_photos(*)")
 .eq("booking_id", bookingId)
 .eq("status","sent")
 .maybeSingle();

 if (error) {
 console.error("Error loading report:", error);
 }

 if (data) {
 setReport(data);
 const reportPhotos = (data as any).grooming_report_photos || [];
 setPhotos(reportPhotos.sort((a: any, b: any) => a.display_order - b.display_order));

 // Get signed URLs for private bucket
 const urls: Record<string, string> = {};
 for (const photo of reportPhotos) {
 const { data: signedData } = await supabase.storage
 .from("grooming-reports")
 .createSignedUrl(photo.photo_url, 3600);
 if (signedData?.signedUrl) {
 urls[photo.photo_url] = signedData.signedUrl;
 }
 }
 setSignedUrls(urls);
 }
 setLoading(false);
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center py-4">
 <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
 </div>
 );
 }

 if (!report) return null;

 return (
 <>
 <Card className="border-primary/20 bg-primary/5">
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <FileText className="w-4 h-4 text-primary" />
 Grooming Report Card
 {report.pet_name && (
 <Badge variant="outline" className="text-xs gap-1">
 <PawBucksLogo className="w-3 h-3" />
 {report.pet_name}
 </Badge>
 )}
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 {/* Photos */}
 {photos.length > 0 && (
 <div>
 <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
 <Image className="w-3 h-3" /> Photos
 </p>
 <div className="grid grid-cols-3 gap-2">
 {photos.map((photo: any) => (
 <button
 key={photo.id}
 onClick={() => setSelectedPhoto(signedUrls[photo.photo_url] || photo.photo_url)}
 className="aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-90 transition-opacity"
 >
 <img
 src={signedUrls[photo.photo_url] ||""}
 alt={photo.caption ||"Grooming photo"}
 className="w-full h-full object-cover"
 />
 </button>
 ))}
 </div>
 {photos.some((p: any) => p.caption) && (
 <div className="mt-2 space-y-1">
 {photos.filter((p: any) => p.caption).map((p: any, i: number) => (
 <p key={i} className="text-xs text-muted-foreground italic flex items-center gap-1"><Camera className="h-3 w-3" aria-hidden /> {p.caption}</p>
 ))}
 </div>
 )}
 </div>
 )}

 {/* Notes sections */}
 {report.overall_notes && (
 <div>
 <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
 <Scissors className="w-3 h-3" /> Overall
 </p>
 <p className="text-sm">{report.overall_notes}</p>
 </div>
 )}

 {report.behavior_notes && (
 <div>
 <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
 <Heart className="w-3 h-3" /> Behavior
 </p>
 <p className="text-sm">{report.behavior_notes}</p>
 </div>
 )}

 {report.skin_coat_notes && (
 <div>
 <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
 <PawBucksLogo className="w-3 h-3" /> Skin & Coat
 </p>
 <p className="text-sm">{report.skin_coat_notes}</p>
 </div>
 )}

 {report.recommendations && (
 <div>
 <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
 <Lightbulb className="w-3 h-3" /> Recommendations
 </p>
 <p className="text-sm">{report.recommendations}</p>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Photo zoom dialog */}
 <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
 <DialogContent className="max-w-lg p-0 overflow-hidden">
 {selectedPhoto && (
 <img src={selectedPhoto} alt="Grooming photo" className="w-full h-auto" />
 )}
 </DialogContent>
 </Dialog>
 </>
 );
}
