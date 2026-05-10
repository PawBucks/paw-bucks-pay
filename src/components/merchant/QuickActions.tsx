import { Phone, MapPin, Globe, Share2, CalendarDays } from "lucide-react";
import { toast } from"sonner";

type Props = {
 phone?: string;
 address?: string;
 websiteUrl?: string;
 businessName: string;
 storefrontSlug?: string | null;
 onBookClick?: () => void;
 hasBookableServices?: boolean;
};

export function QuickActions({
 phone,
 address,
 websiteUrl,
 businessName,
 onBookClick,
 hasBookableServices,
}: Props) {
 const handleShare = () => {
 const url = window.location.href;
 if (navigator.share) {
 navigator.share({ title: businessName, url });
 } else {
 navigator.clipboard.writeText(url);
 toast.success("Link copied to clipboard!");
 }
 };

 const actions = [
 ...(phone
 ? [{ icon: Phone, label:"Call", href: `tel:${phone}`, color:"text-success" }]
 : []),
 ...(address
 ? [{
 icon: MapPin,
 label:"Directions",
 href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
 color:"text-info",
 external: true,
 }]
 : []),
 ...(websiteUrl
 ? [{
 icon: Globe,
 label:"Website",
 href: websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`,
 color:"text-accent",
 external: true,
 }]
 : []),
 ...(hasBookableServices
 ? [{ icon: CalendarDays, label:"Book", onClick: onBookClick, color:"text-primary" }]
 : []),
 { icon: Share2, label:"Share", onClick: handleShare, color:"text-warning" },
 ];

 return (
 <div className="flex items-center justify-around py-3">
 {actions.map((action) => {
 const Icon = action.icon;
 const inner = (
 <div className="flex flex-col items-center gap-1.5 group cursor-pointer">
 <div className={`w-12 h-12 rounded-full border-2 border-border bg-card flex items-center justify-center transition-all group-hover:scale-110 group-hover:shadow-md ${action.color}`}>
 <Icon className="w-5 h-5" />
 </div>
 <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
 {action.label}
 </span>
 </div>
 );

 if ("href" in action && action.href) {
 return (
 <a
 key={action.label}
 href={action.href}
 target={"external" in action ?"_blank" : undefined}
 rel={"external" in action ?"noopener noreferrer" : undefined}
 className="no-underline"
 >
 {inner}
 </a>
 );
 }

 return (
 <button key={action.label} onClick={action.onClick} className="bg-transparent border-none p-0">
 {inner}
 </button>
 );
 })}
 </div>
 );
}
