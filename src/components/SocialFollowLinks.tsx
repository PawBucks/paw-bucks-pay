import { Facebook, Instagram, Linkedin, Twitter } from"lucide-react";

const socialLinks = [
 {
 name:"X (Twitter)",
 url:"https://x.com/pawbucks_app?s=21&t=s5ndptUyCbyuOkaUFdTouw",
 icon: Twitter,
 label:"Follow us on X",
 },
 {
 name:"Instagram",
 url:"https://instagram.com/pawbucks.app",
 icon: Instagram,
 label:"Follow us on Instagram",
 },
 {
 name:"Facebook",
 url:"https://www.facebook.com/profile.php?id=61584920052755&mibextid=wwXIfr",
 icon: Facebook,
 label:"Follow us on Facebook",
 },
 {
 name:"LinkedIn",
 url:"https://www.linkedin.com/company/pawbucks/",
 icon: Linkedin,
 label:"Follow us on LinkedIn",
 },
];

interface SocialFollowLinksProps {
 className?: string;
 showLabel?: boolean;
}

export const SocialFollowLinks = ({ className ="", showLabel = true }: SocialFollowLinksProps) => {
 return (
 <div className={`flex flex-col items-center gap-3 ${className}`}>
 {showLabel && (
 <p className="text-sm font-medium text-muted-foreground">Follow Us</p>
 )}
 <div className="flex items-center gap-4">
 {socialLinks.map((social) => (
 <a
 key={social.name}
 href={social.url}
 target="_blank"
 rel="noopener noreferrer"
 className="w-10 h-10 rounded-full bg-muted hover:bg-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary transition-all duration-200 hover:scale-110"
 aria-label={social.label}
 >
 <social.icon className="w-5 h-5" />
 </a>
 ))}
 </div>
 </div>
 );
};
