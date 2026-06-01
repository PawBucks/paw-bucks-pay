import { useState } from"react";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
} from"@/components/ui/dialog";
import { Button } from"@/components/ui/button";
import { useToast } from"@/hooks/use-toast";
import { MessageSquare, Mail, Facebook, Twitter, Link2, Printer, Smartphone, Copy, Check, MessageCircle, Users } from "lucide-react";
import { generateHighReadabilityFlyer } from"@/components/HighReadabilityFlyer";

interface LostPetPost {
 id: string;
 pet_name: string;
 pet_type: string;
 breed: string | null;
 color_markings: string;
 size?: string | null;
 gender?: string | null;
 identifying_features?: string | null;
 last_seen_location: string;
 last_seen_date: string;
 contact_phone: string;
 contact_email: string | null;
 reward_amount: number | null;
 photo_url: string | null;
}

interface LostPetShareDialogProps {
 post: LostPetPost;
 children?: React.ReactNode;
}

export const LostPetShareDialog = ({ post, children }: LostPetShareDialogProps) => {
 const { toast } = useToast();
 const [copied, setCopied] = useState(false);
 const [isOpen, setIsOpen] = useState(false);

 // Always use production domain so shared links work for everyone
 const APP_BASE_URL ='https://pawbucks.app';
 const shareUrl = `${APP_BASE_URL}/lost-pets/${post.id}`;
 
 // Check if Web Share API is available (mainly for mobile)
 const canNativeShare = typeof navigator !=='undefined' && navigator.share;

 const handleNativeShare = async () => {
 try {
 await navigator.share({
 url: shareUrl,
 });
 toast({ title:"Shared successfully!" });
 setIsOpen(false);
 } catch (error: any) {
 if (error.name !=='AbortError') {
 toast({ title:"Unable to share", variant:"destructive" });
 }
 }
 };

 const handleCopyLink = async () => {
 try {
 await navigator.clipboard.writeText(shareUrl);
 setCopied(true);
 toast({ title:"Link copied to clipboard!" });
 setTimeout(() => setCopied(false), 2000);
 } catch {
 toast({ title:"Failed to copy", variant:"destructive" });
 }
 };

 const handleSMSShare = () => {
 const smsBody = encodeURIComponent(shareUrl);
 // Use different SMS URI schemes for different devices
 const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
 const smsUrl = isIOS ? `sms:&body=${smsBody}` : `sms:?body=${smsBody}`;
 window.open(smsUrl,'_blank');
 };

 const handleEmailShare = () => {
 const body = encodeURIComponent(shareUrl);
 window.open(`mailto:?body=${body}`,'_blank');
 };

 const handleWhatsAppShare = () => {
 const text = encodeURIComponent(shareUrl);
 window.open(`https://wa.me/?text=${text}`,'_blank');
 };

 const handleFacebookShare = () => {
 const url = encodeURIComponent(shareUrl);
 window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`,'_blank','width=600,height=400');
 };

 const handleTwitterShare = () => {
 const url = encodeURIComponent(shareUrl);
 window.open(`https://twitter.com/intent/tweet?url=${url}`,'_blank','width=600,height=400');
 };

 const handleNextdoorShare = () => {
 window.open(`https://nextdoor.com/`,'_blank');
 navigator.clipboard.writeText(shareUrl);
 toast({ 
 title:"Link copied!", 
 description:"Paste the flyer URL on your Nextdoor neighborhood page" 
 });
 };

 const handlePrint = () => {
 // Use the high-readability flyer design
 const printWindow = window.open('','_blank');
 if (!printWindow) {
 toast({ title:"Please allow popups to print", variant:"destructive" });
 return;
 }

 const flyerHtml = generateHighReadabilityFlyer({
 pet_name: post.pet_name,
 pet_type: post.pet_type,
 breed: post.breed,
 color_markings: post.color_markings,
 size: post.size,
 gender: post.gender,
 identifying_features: post.identifying_features,
 last_seen_location: post.last_seen_location,
 last_seen_date: post.last_seen_date,
 contact_phone: post.contact_phone,
 contact_email: post.contact_email,
 reward_amount: post.reward_amount,
 photo_url: post.photo_url,
 }, shareUrl);

 printWindow.document.write(flyerHtml);
 printWindow.document.close();
 printWindow.print();
 };

 const shareOptions = [
 {
 name:"Facebook",
 icon: Facebook,
 onClick: handleFacebookShare,
 borderColor:"border-info/40",
 iconColor:"text-info",
 },
 {
 name:"Twitter / X",
 icon: Twitter,
 onClick: handleTwitterShare,
 borderColor:"border-info",
 iconColor:"text-info",
 },
 {
 name:"WhatsApp",
 icon: MessageCircle,
 onClick: handleWhatsAppShare,
 borderColor:"border-success",
 iconColor:"text-success",
 },
 {
 name:"SMS / Text",
 icon: MessageSquare,
 onClick: handleSMSShare,
 borderColor:"border-success/40",
 iconColor:"text-success",
 },
 {
 name:"Email",
 icon: Mail,
 onClick: handleEmailShare,
 borderColor:"border-destructive",
 iconColor:"text-destructive",
 },
 {
 name:"Nextdoor",
 icon: Users,
 onClick: handleNextdoorShare,
 borderColor:"border-success/40",
 iconColor:"text-success",
 },
 {
 name:"Print Flyer",
 icon: Printer,
 onClick: handlePrint,
 borderColor:"border-warning",
 iconColor:"text-warning",
 },
 {
 name:"Copy Link",
 icon: copied ? Check : Link2,
 onClick: handleCopyLink,
 borderColor:"border-border0",
 iconColor:"text-muted-foreground0",
 },
 ];

 return (
 <Dialog open={isOpen} onOpenChange={setIsOpen}>
 <DialogTrigger asChild>
 {children || (
 <Button variant="outline" size="sm" className="gap-2">
 <span className="w-4 h-4" aria-hidden="true">🔗</span>
 Share
 </Button>
 )}
 </DialogTrigger>
<DialogContent className="max-w-md w-[calc(100vw-2rem)] lg:max-w-7xl lg:w-auto max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <span className="w-5 h-5 text-primary" aria-hidden="true">🔗</span>
 Share {post.pet_name}'s Flyer
 </DialogTitle>
 </DialogHeader>

 {/* Desktop: Horizontal layout, Mobile: Vertical layout */}
 <div className="flex flex-col lg:flex-row lg:gap-6">
 {/* Left side: Pet preview (desktop only) */}
 <div className="hidden lg:block lg:w-64 shrink-0">
 <div className="rounded-lg overflow-hidden border bg-muted">
 {post.photo_url ? (
 <img 
 src={post.photo_url} 
 alt={post.pet_name} 
 className="w-full h-48 object-cover"
 />
 ) : (
 <div className="w-full h-48 flex items-center justify-center text-muted-foreground">
 No Photo
 </div>
 )}
 <div className="p-3">
 <p className="font-semibold text-sm">{post.pet_name}</p>
 <p className="text-xs text-muted-foreground truncate">
 {post.breed && `${post.breed} • `}{post.color_markings}
 </p>
 <p className="text-xs text-muted-foreground mt-1 truncate">
 📍 {post.last_seen_location}
 </p>
 </div>
 </div>
 </div>

 {/* Right side: Share options */}
 <div className="flex-1 space-y-3">
 {/* Quick Native Share for Mobile */}
 {canNativeShare && (
 <Button 
 onClick={handleNativeShare} 
 className="w-full gap-2"
 size="lg"
 >
 <Smartphone className="w-5 h-5" />
 Share via Phone
 </Button>
 )}

 {/* Share Options - Icon-only circular buttons */}
 <div className="flex flex-wrap justify-center gap-3 py-2">
 {shareOptions.map((option) => (
 <button
 key={option.name}
 onClick={option.onClick}
 title={option.name}
 className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 hover:shadow-md bg-background ${option.borderColor}`}
 >
 <option.icon className={`w-5 h-5 ${option.iconColor}`} />
 </button>
 ))}
 </div>

 {/* Share Preview */}
 <div className="p-3 bg-muted rounded-lg">
 <p className="text-xs text-muted-foreground mb-1.5 font-medium">Preview:</p>
 <p className="text-xs sm:text-sm break-all">{shareUrl}</p>
 </div>

 {/* Direct Link */}
 <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
 <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
 <span className="text-xs text-muted-foreground truncate flex-1">
 {shareUrl}
 </span>
 <Button 
 variant="ghost" 
 size="sm" 
 onClick={handleCopyLink}
 className="shrink-0 h-8 w-8 p-0"
 >
 {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
 </Button>
 </div>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 );
};
