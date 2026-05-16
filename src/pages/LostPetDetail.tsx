import { useState } from"react";
import { useParams, useNavigate } from"react-router-dom";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { useAuth } from"@/hooks/useAuth";
import { Header } from"@/components/Header";
import { BottomNav } from"@/components/BottomNav";
import { Button } from"@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import {
 AlertDialog,
 AlertDialogAction,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
 AlertDialogTrigger,
} from"@/components/ui/alert-dialog";
import { useToast } from"@/hooks/use-toast";
import { LoadingSpinner } from"@/components/LoadingSpinner";
import { SEO } from"@/components/SEO";
import { LostPetShareDialog } from"@/components/LostPetShareDialog";
import { PhotoLightbox, PhotoThumbnail } from"@/components/PhotoLightbox";
import { format } from"date-fns";
import { jsPDF } from"jspdf";
import { ArrowLeft, Bird, Rabbit, AlertTriangle, CheckCircle2, PartyPopper, Images, Download, Loader2 } from "lucide-react";

interface LostPetPost {
 id: string;
 user_id: string;
 pet_name: string;
 pet_type: string;
 breed: string | null;
 color_markings: string;
 size: string | null;
 age_estimate: string | null;
 gender: string | null;
 microchip_number: string | null;
 collar_description: string | null;
 identifying_features: string | null;
 photo_url: string | null;
 photo_urls: string[] | null;
 last_seen_location: string;
 last_seen_date: string;
 last_seen_time: string | null;
 last_seen_area_description: string | null;
 contact_name: string;
 contact_phone: string;
 contact_email: string | null;
 reward_amount: number | null;
 additional_notes: string | null;
 status: string;
 is_active: boolean;
 created_at: string;
}

const petTypeIcons: Record<string, React.ReactNode> = {
 dog: <span className="w-6 h-6" aria-hidden="true">🐕</span>,
 cat: <span className="w-6 h-6" aria-hidden="true">🐈</span>,
 bird: <Bird className="w-6 h-6" />,
 rabbit: <Rabbit className="w-6 h-6" />,
};

const statusColors: Record<string, string> = {
 lost:"bg-destructive text-destructive-foreground",
 found:"bg-secondary text-secondary-foreground",
 reunited:"bg-success text-white",
};

const statusIcons: Record<string, React.ReactNode> = {
 lost: <AlertTriangle className="w-4 h-4" />,
 found: <span className="w-4 h-4" aria-hidden="true">⏰</span>,
 reunited: <CheckCircle2 className="w-4 h-4" />,
};

const LostPetDetail = () => {
 const { id } = useParams<{ id: string }>();
 const navigate = useNavigate();
 const { user } = useAuth();
 const { toast } = useToast();
 const queryClient = useQueryClient();
 const [lightboxOpen, setLightboxOpen] = useState(false);
 const [lightboxIndex, setLightboxIndex] = useState(0);
 const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

 const { data: post, isLoading, error } = useQuery({
 queryKey: ["lost-pet-post", id],
 queryFn: async () => {
 if (!id) throw new Error("No post ID provided");
 const { data, error } = await supabase
 .from("lost_pet_posts")
 .select("*")
 .eq("id", id)
 .maybeSingle();
 if (error) throw error;
 if (!data) throw new Error("Post not found");
 return data as LostPetPost;
 },
 enabled: !!id,
 });

 // Get all photos (combine photo_urls with legacy photo_url)
 const allPhotos = post ? [
 ...(post.photo_urls?.filter(Boolean) || []),
 // Include legacy photo_url if not already in photo_urls
 ...(post.photo_url && !post.photo_urls?.includes(post.photo_url) ? [post.photo_url] : [])
 ].filter(Boolean) : [];

 const openLightbox = (index: number) => {
 setLightboxIndex(index);
 setLightboxOpen(true);
 };

 const updateStatusMutation = useMutation({
 mutationFn: async (newStatus: string) => {
 if (!id) throw new Error("No post ID");
 const { error } = await supabase
 .from("lost_pet_posts")
 .update({ status: newStatus })
 .eq("id", id);
 if (error) throw error;
 },
 onSuccess: (_, newStatus) => {
 toast({ 
 title: newStatus ==="reunited" 
 ?"Great news! Pet marked as reunited!" 
 : `Status updated to ${newStatus}` 
 });
 queryClient.invalidateQueries({ queryKey: ["lost-pet-post", id] });
 queryClient.invalidateQueries({ queryKey: ["lost-pet-posts"] });
 },
 onError: (error: Error) => {
 toast({
 title:"Failed to update status",
 description: error.message,
 variant:"destructive",
 });
 },
 });

 const isOwner = user?.id === post?.user_id;

 // Generate PDF Flyer
 const generatePdfFlyer = async () => {
 if (!post) return;
 
 setIsGeneratingPdf(true);
 
 try {
 const pdf = new jsPDF({
 orientation:"portrait",
 unit:"mm",
 format:"letter",
 });

 const pageWidth = pdf.internal.pageSize.getWidth();
 const pageHeight = pdf.internal.pageSize.getHeight();
 const margin = 15;
 let yPos = margin;

 // Header Banner - Status
 const statusText = post.status ==="lost" ?"LOST PET" : post.status ==="found" ?"FOUND PET" :"REUNITED";
 const statusColor = post.status ==="lost" ? [220, 38, 38] : post.status ==="reunited" ? [34, 197, 94] : [59, 130, 246];
 
 pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
 pdf.rect(0, 0, pageWidth, 25,"F");
 pdf.setTextColor(255, 255, 255);
 pdf.setFontSize(28);
 pdf.setFont("helvetica","bold");
 pdf.text(statusText, pageWidth / 2, 17, { align:"center" });

 yPos = 35;

 // Pet Name - Large
 pdf.setTextColor(0, 0, 0);
 pdf.setFontSize(32);
 pdf.setFont("helvetica","bold");
 pdf.text(post.pet_name.toUpperCase(), pageWidth / 2, yPos, { align:"center" });
 yPos += 12;

 // Pet description line
 pdf.setFontSize(14);
 pdf.setFont("helvetica","normal");
 const description = [
 post.breed,
 post.color_markings,
 post.size ? `${post.size.charAt(0).toUpperCase() + post.size.slice(1)} size` : null,
 post.gender ? post.gender.charAt(0).toUpperCase() + post.gender.slice(1) : null,
 post.age_estimate,
 ].filter(Boolean).join(" •");
 pdf.text(description, pageWidth / 2, yPos, { align:"center", maxWidth: pageWidth - margin * 2 });
 yPos += 10;

 // Photo placeholder area
 const photoAreaHeight = 80;
 const photoAreaWidth = pageWidth - margin * 2;
 
 // Try to add pet photo
 if (allPhotos.length > 0) {
 try {
 const response = await fetch(allPhotos[0]);
 const blob = await response.blob();
 const base64 = await new Promise<string>((resolve) => {
 const reader = new FileReader();
 reader.onloadend = () => resolve(reader.result as string);
 reader.readAsDataURL(blob);
 });
 
 // Add image centered
 const imgWidth = 70;
 const imgHeight = 70;
 pdf.addImage(base64,"JPEG", (pageWidth - imgWidth) / 2, yPos, imgWidth, imgHeight);
 yPos += imgHeight + 8;
 } catch {
 // If image fails, add placeholder
 pdf.setDrawColor(200, 200, 200);
 pdf.setFillColor(245, 245, 245);
 pdf.roundedRect(margin, yPos, photoAreaWidth, photoAreaHeight, 3, 3,"FD");
 pdf.setTextColor(150, 150, 150);
 pdf.setFontSize(16);
 pdf.text("Photo of" + post.pet_name, pageWidth / 2, yPos + photoAreaHeight / 2, { align:"center" });
 yPos += photoAreaHeight + 8;
 }
 } else {
 pdf.setDrawColor(200, 200, 200);
 pdf.setFillColor(245, 245, 245);
 pdf.roundedRect(margin, yPos, photoAreaWidth, photoAreaHeight, 3, 3,"FD");
 pdf.setTextColor(150, 150, 150);
 pdf.setFontSize(16);
 pdf.text("Photo of" + post.pet_name, pageWidth / 2, yPos + photoAreaHeight / 2, { align:"center" });
 yPos += photoAreaHeight + 8;
 }

 // Last Seen Box
 pdf.setFillColor(254, 226, 226);
 pdf.roundedRect(margin, yPos, photoAreaWidth, 28, 3, 3,"F");
 pdf.setTextColor(153, 27, 27);
 pdf.setFontSize(12);
 pdf.setFont("helvetica","bold");
 pdf.text("LAST SEEN", margin + 5, yPos + 8);
 pdf.setFontSize(14);
 pdf.setFont("helvetica","normal");
 pdf.text(post.last_seen_location, margin + 5, yPos + 16);
 const dateText = format(new Date(post.last_seen_date),"EEEE, MMMM d, yyyy") + (post.last_seen_time ? ` at ${post.last_seen_time}` :"");
 pdf.setFontSize(11);
 pdf.text(dateText, margin + 5, yPos + 23);
 yPos += 35;

 // Identifying Features
 if (post.identifying_features || post.collar_description || post.microchip_number) {
 pdf.setTextColor(0, 0, 0);
 pdf.setFontSize(12);
 pdf.setFont("helvetica","bold");
 pdf.text("IDENTIFYING FEATURES:", margin, yPos);
 yPos += 6;
 pdf.setFont("helvetica","normal");
 pdf.setFontSize(11);
 
 if (post.identifying_features) {
 const splitFeatures = pdf.splitTextToSize(post.identifying_features, photoAreaWidth);
 pdf.text(splitFeatures, margin, yPos);
 yPos += splitFeatures.length * 5 + 2;
 }
 if (post.collar_description) {
 pdf.text(`Collar: ${post.collar_description}`, margin, yPos);
 yPos += 5;
 }
 if (post.microchip_number) {
 pdf.text(`Microchip: ${post.microchip_number}`, margin, yPos);
 yPos += 5;
 }
 yPos += 5;
 }

 // Reward Banner (if applicable)
 if (post.reward_amount) {
 pdf.setFillColor(34, 197, 94);
 pdf.roundedRect(margin, yPos, photoAreaWidth, 18, 3, 3,"F");
 pdf.setTextColor(255, 255, 255);
 pdf.setFontSize(16);
 pdf.setFont("helvetica","bold");
 pdf.text(`$${post.reward_amount} REWARD`, pageWidth / 2, yPos + 12, { align:"center" });
 yPos += 25;
 }

 // Contact Information Box
 pdf.setFillColor(249, 115, 22);
 pdf.roundedRect(margin, yPos, photoAreaWidth, 35, 3, 3,"F");
 pdf.setTextColor(255, 255, 255);
 pdf.setFontSize(14);
 pdf.setFont("helvetica","bold");
 pdf.text("IF FOUND, PLEASE CONTACT:", pageWidth / 2, yPos + 10, { align:"center" });
 pdf.setFontSize(18);
 pdf.text(post.contact_name, pageWidth / 2, yPos + 20, { align:"center" });
 pdf.setFontSize(20);
 pdf.text(post.contact_phone, pageWidth / 2, yPos + 30, { align:"center" });
 yPos += 42;

 // Email if provided
 if (post.contact_email) {
 pdf.setTextColor(0, 0, 0);
 pdf.setFontSize(11);
 pdf.setFont("helvetica","normal");
 pdf.text(`Email: ${post.contact_email}`, pageWidth / 2, yPos, { align:"center" });
 yPos += 8;
 }

 // Footer
 pdf.setTextColor(150, 150, 150);
 pdf.setFontSize(9);
 pdf.text(`Flyer created via PawBucks • ${format(new Date(),"MMM d, yyyy")}`, pageWidth / 2, pageHeight - 10, { align:"center" });

 // Save PDF
 pdf.save(`${post.pet_name.toLowerCase().replace(/\s+/g,"-")}-lost-pet-flyer.pdf`);
 
 toast({
 title:"PDF Downloaded!",
 description:"Your lost pet flyer has been saved.",
 });
 } catch (error) {
 console.error("Error generating PDF:", error);
 toast({
 title:"Failed to generate PDF",
 description:"Please try again.",
 variant:"destructive",
 });
 } finally {
 setIsGeneratingPdf(false);
 }
 };
 if (isLoading) {
 return (
 <div className="min-h-screen bg-background">
 <Header />
 <div className="flex justify-center py-24">
 <LoadingSpinner />
 </div>
 <BottomNav />
 </div>
 );
 }

 if (error || !post) {
 return (
 <div className="min-h-screen bg-background">
 <Header />
 <main className="container mx-auto px-4 py-12 text-center">
 <span className="w-16 h-16 text-muted-foreground mx-auto mb-4" aria-hidden="true">🐕</span>
 <h1 className="text-2xl font-bold mb-2">Post Not Found</h1>
 <p className="text-muted-foreground mb-6">
 This lost pet flyer may have been removed or doesn't exist.
 </p>
 <Button onClick={() => navigate("/lost-pets")}>
 <ArrowLeft className="w-4 h-4 mr-2" />
 Back to Lost Pets
 </Button>
 </main>
 <BottomNav />
 </div>
 );
 }

 return (
 <>
 <SEO
 title={`${post.status ==="lost" ?"LOST" : post.status.toUpperCase()}: ${post.pet_name} | Lost Pet Flyer`}
 description={`Help find ${post.pet_name}! ${post.breed ? `${post.breed}, ` :""}${post.color_markings}. Last seen: ${post.last_seen_location}`}
        type="article"
        ogImage={allPhotos[0]}
        jsonLd={{
          "@context":"https://schema.org",
          "@type":"Article",
          headline: `${post.status ==="lost" ?"LOST" : post.status.toUpperCase()}: ${post.pet_name}`,
          description: `Help find ${post.pet_name}! ${post.breed ? `${post.breed}, ` :""}${post.color_markings}. Last seen: ${post.last_seen_location}`,
          image: allPhotos[0],
          datePublished: post.created_at,
          dateModified: post.created_at,
          author: { "@type":"Person", name: post.contact_name },
        }}
 />
 <div className="min-h-screen bg-background">
 <Header />

 <main className="container mx-auto px-4 py-6 pb-24 md:pb-6">
 {/* Back Button */}
 <Button
 variant="ghost"
 onClick={() => navigate("/lost-pets")}
 className="mb-4 gap-2"
 >
 <ArrowLeft className="w-4 h-4" />
 Back to Lost Pets
 </Button>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Main Content */}
 <div className="lg:col-span-2 space-y-6">
 {/* Photo & Status */}
<Card className="overflow-hidden">
 <div className="relative">
 {/* Photo Gallery */}
 {allPhotos.length > 0 ? (
 <div className="relative">
 {/* Main Photo */}
 <PhotoThumbnail
 src={allPhotos[0]}
 alt={post.pet_name}
 className="w-full h-64 md:h-96"
 onClick={() => openLightbox(0)}
 />
 
 {/* Photo count badge */}
 {allPhotos.length > 1 && (
 <button
 onClick={() => openLightbox(0)}
 className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 hover:bg-black/80 transition-colors"
 >
 <Images className="w-4 h-4" />
 {allPhotos.length} photos
 </button>
 )}
 
 {/* Thumbnail strip for multiple photos */}
 {allPhotos.length > 1 && (
 <div className="flex gap-2 p-3 bg-muted overflow-x-auto">
 {allPhotos.map((photo, index) => (
 <PhotoThumbnail
 key={index}
 src={photo}
 alt={`${post.pet_name} photo ${index + 1}`}
 className="w-16 h-16 shrink-0 border-2 border-transparent hover:border-primary"
 onClick={() => openLightbox(index)}
 />
 ))}
 </div>
 )}
 </div>
 ) : (
 <div className="w-full h-64 md:h-96 bg-muted flex items-center justify-center">
 {petTypeIcons[post.pet_type] || (
 <span className="w-24 h-24 text-muted-foreground" aria-hidden="true">🐕</span>
 )}
 </div>
 )}
 
 {/* Status badge */}
 <Badge
 className={`absolute top-4 left-4 gap-1 text-base px-3 py-1 ${statusColors[post.status]}`}
 >
 {statusIcons[post.status]}
 {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
 </Badge>
 {post.reward_amount && (
 <Badge className="absolute top-4 right-4 bg-success text-white gap-1 text-base px-3 py-1">
 <span className="w-4 h-4" aria-hidden="true">💵</span>
 ${post.reward_amount} Reward
 </Badge>
 )}
 </div>

 {/* Photo Lightbox */}
 <PhotoLightbox
 photos={allPhotos}
 initialIndex={lightboxIndex}
 open={lightboxOpen}
 onOpenChange={setLightboxOpen}
 />

 <CardHeader>
 <CardTitle className="flex items-center gap-3 text-2xl md:text-3xl">
 {petTypeIcons[post.pet_type]}
 {post.pet_name}
 </CardTitle>
 <p className="text-muted-foreground">
 {post.breed && `${post.breed} • `}
 {post.color_markings}
 {post.size && ` • ${post.size.charAt(0).toUpperCase() + post.size.slice(1)}`}
 {post.gender && ` • ${post.gender.charAt(0).toUpperCase() + post.gender.slice(1)}`}
 {post.age_estimate && ` • ${post.age_estimate}`}
 </p>
 </CardHeader>

 <CardContent className="space-y-4">
 {/* Last Seen */}
 <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
 <div className="flex items-start gap-3">
 <span className="w-5 h-5 text-destructive shrink-0 mt-0.5" aria-hidden="true">📍</span>
 <div>
 <p className="font-semibold text-lg">
 Last seen: {post.last_seen_location}
 </p>
 <p className="text-muted-foreground">
 {format(new Date(post.last_seen_date),"EEEE, MMMM d, yyyy")}
 {post.last_seen_time && ` at ${post.last_seen_time}`}
 </p>
 {post.last_seen_area_description && (
 <p className="mt-1 text-sm">
 {post.last_seen_area_description}
 </p>
 )}
 </div>
 </div>
 </div>

 {/* Identifying Features */}
 {(post.identifying_features || post.collar_description || post.microchip_number) && (
 <div className="space-y-2">
 <h3 className="font-semibold">Identifying Features</h3>
 {post.identifying_features && (
 <p className="text-muted-foreground">{post.identifying_features}</p>
 )}
 {post.collar_description && (
 <p className="text-sm">
 <span className="font-medium">Collar:</span> {post.collar_description}
 </p>
 )}
 {post.microchip_number && (
 <p className="text-sm">
 <span className="font-medium">Microchip:</span> {post.microchip_number}
 </p>
 )}
 </div>
 )}

 {/* Additional Notes */}
 {post.additional_notes && (
 <div className="space-y-2">
 <h3 className="font-semibold">Additional Notes</h3>
 <p className="text-muted-foreground">{post.additional_notes}</p>
 </div>
 )}

 {/* Posted Date */}
 <div className="flex items-center gap-2 text-sm text-muted-foreground pt-4 border-t">
 <span className="w-4 h-4" aria-hidden="true">📅</span>
 Posted {format(new Date(post.created_at),"MMMM d, yyyy")}
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Sidebar */}
 <div className="space-y-4">
 {/* Contact Card */}
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-lg">Contact Information</CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <p className="font-medium">{post.contact_name}</p>
 <a
 href={`tel:${post.contact_phone}`}
 className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
 >
 <span className="w-5 h-5 text-primary" aria-hidden="true">📞</span>
 <span className="font-medium">{post.contact_phone}</span>
 </a>
 {post.contact_email && (
 <a
 href={`mailto:${post.contact_email}`}
 className="flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
 >
 <span className="w-5 h-5 text-primary" aria-hidden="true">📧</span>
 <span className="truncate">{post.contact_email}</span>
 </a>
 )}
 </CardContent>
 </Card>

 {/* Actions */}
 <Card>
 <CardContent className="pt-6 space-y-3">
 <Button 
 className="w-full gap-2" 
 size="lg"
 variant="default"
 onClick={generatePdfFlyer}
 disabled={isGeneratingPdf}
 >
 {isGeneratingPdf ? (
 <Loader2 className="w-5 h-5 animate-spin" />
 ) : (
 <Download className="w-5 h-5" />
 )}
 {isGeneratingPdf ?"Generating PDF..." :"Download Flyer as PDF"}
 </Button>
 
 <LostPetShareDialog post={post}>
 <Button className="w-full gap-2" size="lg" variant="outline">
 <span className="w-5 h-5" aria-hidden="true">🔗</span>
 Share Flyer
 </Button>
 </LostPetShareDialog>

 {/* Owner Actions */}
 {isOwner && post.status ==="lost" && (
 <AlertDialog>
 <AlertDialogTrigger asChild>
 <Button
 variant="outline"
 className="w-full gap-2 border-success text-success hover:bg-success/10 hover:text-success"
 size="lg"
 >
 <PartyPopper className="w-5 h-5" />
 Mark as Found / Reunited
 </Button>
 </AlertDialogTrigger>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle className="flex items-center gap-2">
 <PartyPopper className="w-5 h-5 text-success" />
 Great News!
 </AlertDialogTitle>
 <AlertDialogDescription>
 Has {post.pet_name} been found and reunited with you? This will update
 the flyer status to show that {post.pet_name} is no longer missing.
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel>Cancel</AlertDialogCancel>
 <AlertDialogAction
 onClick={() => updateStatusMutation.mutate("reunited")}
 className="bg-success hover:bg-success"
 >
 Yes, {post.pet_name} is home!
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 )}

 {isOwner && post.status ==="reunited" && (
 <div className="p-3 bg-success/10 rounded-lg text-center">
 <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2" />
 <p className="text-sm text-success font-medium">
 {post.pet_name} has been reunited!
 </p>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Reward Card */}
 {post.reward_amount && (
 <Card className="bg-success/10 border-success/20">
 <CardContent className="pt-6 text-center">
 <span className="w-10 h-10 text-success mx-auto mb-2" aria-hidden="true">💵</span>
 <p className="text-2xl font-bold text-success">
 ${post.reward_amount} Reward
 </p>
 <p className="text-sm text-success mt-1">
 For safe return of {post.pet_name}
 </p>
 </CardContent>
 </Card>
 )}
 </div>
 </div>
 </main>

 <BottomNav />
 </div>
 </>
 );
};

export default LostPetDetail;
