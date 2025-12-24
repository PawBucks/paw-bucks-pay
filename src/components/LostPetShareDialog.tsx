import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Share2,
  MessageSquare,
  Mail,
  Facebook,
  Twitter,
  Link2,
  Printer,
  Smartphone,
  Copy,
  Check,
  MessageCircle,
  Users,
} from "lucide-react";

interface LostPetPost {
  id: string;
  pet_name: string;
  pet_type: string;
  breed: string | null;
  color_markings: string;
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

  // Generate share content - link to the dedicated pet detail page
  const shareUrl = `${window.location.origin}/lost-pets/${post.id}`;
  
  const shareTitle = `🚨 LOST ${post.pet_type.toUpperCase()}: ${post.pet_name}`;
  
  const shareText = `🚨 LOST ${post.pet_type.toUpperCase()}: ${post.pet_name}

📍 Last seen: ${post.last_seen_location}
📅 Date: ${new Date(post.last_seen_date).toLocaleDateString()}
🐾 Description: ${post.breed ? `${post.breed}, ` : ''}${post.color_markings}
${post.reward_amount ? `💰 Reward: $${post.reward_amount}` : ''}

📞 Contact: ${post.contact_phone}
${post.contact_email ? `📧 Email: ${post.contact_email}` : ''}

Please share to help bring ${post.pet_name} home! 🙏`;

  const shortShareText = `🚨 LOST ${post.pet_type.toUpperCase()}: ${post.pet_name} - Last seen: ${post.last_seen_location}. Contact: ${post.contact_phone}. Please help!`;

  // Check if Web Share API is available (mainly for mobile)
  const canNativeShare = typeof navigator !== 'undefined' && navigator.share;

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      });
      toast({ title: "Shared successfully!" });
      setIsOpen(false);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        toast({ title: "Unable to share", variant: "destructive" });
      }
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${shareTitle}\n\n${shareText}\n\n${shareUrl}`);
      setCopied(true);
      toast({ title: "Copied to clipboard!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleSMSShare = () => {
    // Build detailed SMS message format
    const smsText = `🚨 LOST ${post.pet_type.toUpperCase()}: ${post.pet_name}

📍 Last seen: ${post.last_seen_location}
📅 Date: ${new Date(post.last_seen_date).toLocaleDateString()}
🐾 Description: ${post.breed ? `${post.breed}, ` : ''}${post.color_markings}${post.reward_amount ? `
💰 Reward: $${post.reward_amount}` : ''}

📞 Contact: ${post.contact_phone}${post.contact_email ? `
📧 Email: ${post.contact_email}` : ''}

Please share to help bring ${post.pet_name} home! 🙏

${shareUrl}`;
    
    const smsBody = encodeURIComponent(smsText);
    // Use different SMS URI schemes for different devices
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const smsUrl = isIOS ? `sms:&body=${smsBody}` : `sms:?body=${smsBody}`;
    window.open(smsUrl, '_blank');
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent(shareTitle);
    const body = encodeURIComponent(`${shareText}\n\nView flyer: ${shareUrl}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleFacebookShare = () => {
    const url = encodeURIComponent(shareUrl);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${encodeURIComponent(shortShareText)}`, '_blank', 'width=600,height=400');
  };

  const handleTwitterShare = () => {
    const text = encodeURIComponent(shortShareText);
    const url = encodeURIComponent(shareUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'width=600,height=400');
  };

  const handleNextdoorShare = () => {
    // Nextdoor doesn't have a direct share API, but we can guide users
    const text = encodeURIComponent(shareText);
    window.open(`https://nextdoor.com/`, '_blank');
    // Copy content for easy pasting
    navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
    toast({ 
      title: "Content copied!", 
      description: "Paste this on your Nextdoor neighborhood page" 
    });
  };

  // HTML escape function to prevent XSS
  const escapeHtml = (text: string | null | undefined): string => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const handlePrint = () => {
    // Create a printable version of the flyer
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: "Please allow popups to print", variant: "destructive" });
      return;
    }

    // Escape all user-supplied data to prevent XSS
    const safePetName = escapeHtml(post.pet_name);
    const safePetType = escapeHtml(post.pet_type);
    const safeLastSeenLocation = escapeHtml(post.last_seen_location);
    const safeBreed = escapeHtml(post.breed);
    const safeColorMarkings = escapeHtml(post.color_markings);
    const safeContactPhone = escapeHtml(post.contact_phone);
    const safeContactEmail = escapeHtml(post.contact_email);
    const safePhotoUrl = escapeHtml(post.photo_url);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lost Pet Flyer - ${safePetName}</title>
          <style>
            @media print {
              body { margin: 0; padding: 20px; }
            }
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              text-align: center;
              border: 4px solid #ef4444;
              padding: 20px;
              margin-bottom: 20px;
              background: #fef2f2;
            }
            .header h1 {
              color: #ef4444;
              font-size: 48px;
              margin: 0 0 10px 0;
              text-transform: uppercase;
            }
            .pet-name {
              font-size: 36px;
              font-weight: bold;
              margin: 10px 0;
            }
            .photo {
              text-align: center;
              margin: 20px 0;
            }
            .photo img {
              max-width: 400px;
              max-height: 400px;
              border: 2px solid #ccc;
            }
            .no-photo {
              width: 300px;
              height: 200px;
              background: #f0f0f0;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto;
              border: 2px dashed #ccc;
              color: #666;
            }
            .details {
              font-size: 18px;
              line-height: 1.8;
            }
            .details strong {
              color: #333;
            }
            .contact {
              text-align: center;
              background: #fef3c7;
              padding: 20px;
              margin: 20px 0;
              border: 2px solid #f59e0b;
              font-size: 24px;
            }
            .reward {
              text-align: center;
              background: #d1fae5;
              padding: 15px;
              border: 2px solid #10b981;
              font-size: 28px;
              font-weight: bold;
              color: #065f46;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              font-size: 14px;
              color: #666;
            }
            .tear-off {
              display: flex;
              justify-content: space-between;
              border-top: 2px dashed #ccc;
              padding-top: 10px;
              margin-top: 20px;
            }
            .tear-strip {
              writing-mode: vertical-rl;
              text-orientation: mixed;
              border: 1px solid #ccc;
              padding: 5px;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🚨 LOST ${safePetType.toUpperCase()} 🚨</h1>
            <div class="pet-name">${safePetName}</div>
          </div>
          
          <div class="photo">
            ${safePhotoUrl 
              ? `<img src="${safePhotoUrl}" alt="${safePetName}" />` 
              : `<div class="no-photo">No Photo Available</div>`
            }
          </div>
          
          <div class="details">
            <p><strong>📍 Last Seen:</strong> ${safeLastSeenLocation}</p>
            <p><strong>📅 Date:</strong> ${new Date(post.last_seen_date).toLocaleDateString()}</p>
            ${safeBreed ? `<p><strong>🐾 Breed:</strong> ${safeBreed}</p>` : ''}
            <p><strong>🎨 Color/Markings:</strong> ${safeColorMarkings}</p>
          </div>
          
          ${post.reward_amount ? `
            <div class="reward">
              💰 REWARD: $${post.reward_amount}
            </div>
          ` : ''}
          
          <div class="contact">
            <strong>PLEASE CONTACT:</strong><br/>
            📞 ${safeContactPhone}
            ${safeContactEmail ? `<br/>📧 ${safeContactEmail}` : ''}
          </div>
          
          <div class="footer">
            <p>Please help bring ${safePetName} home! Share this flyer with friends and neighbors.</p>
            <p>View online: ${shareUrl}</p>
          </div>
          
          <div class="tear-off">
            ${Array(5).fill(null).map(() => `
              <div class="tear-strip">
                LOST: ${safePetName}<br/>
                📞 ${safeContactPhone}
              </div>
            `).join('')}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const shareOptions = [
    {
      name: "Copy All Info",
      icon: copied ? Check : Copy,
      onClick: handleCopyLink,
      color: "text-foreground",
      bg: "bg-muted hover:bg-muted/80",
    },
    {
      name: "SMS / Text",
      icon: MessageSquare,
      onClick: handleSMSShare,
      color: "text-green-600",
      bg: "bg-green-50 hover:bg-green-100 dark:bg-green-950 dark:hover:bg-green-900",
    },
    {
      name: "WhatsApp",
      icon: MessageCircle,
      onClick: handleWhatsAppShare,
      color: "text-green-500",
      bg: "bg-green-50 hover:bg-green-100 dark:bg-green-950 dark:hover:bg-green-900",
    },
    {
      name: "Email",
      icon: Mail,
      onClick: handleEmailShare,
      color: "text-blue-600",
      bg: "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900",
    },
    {
      name: "Facebook",
      icon: Facebook,
      onClick: handleFacebookShare,
      color: "text-blue-600",
      bg: "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900",
    },
    {
      name: "Twitter / X",
      icon: Twitter,
      onClick: handleTwitterShare,
      color: "text-sky-500",
      bg: "bg-sky-50 hover:bg-sky-100 dark:bg-sky-950 dark:hover:bg-sky-900",
    },
    {
      name: "Nextdoor",
      icon: Users,
      onClick: handleNextdoorShare,
      color: "text-emerald-600",
      bg: "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:hover:bg-emerald-900",
    },
    {
      name: "Print Flyer",
      icon: Printer,
      onClick: handlePrint,
      color: "text-orange-600",
      bg: "bg-orange-50 hover:bg-orange-100 dark:bg-orange-950 dark:hover:bg-orange-900",
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        )}
      </DialogTrigger>
<DialogContent className="max-w-md w-[calc(100vw-2rem)] lg:max-w-4xl lg:w-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
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

            {/* Share Options - Vertical list on mobile, 4 cols on desktop */}
            <div className="flex flex-col gap-2 lg:grid lg:grid-cols-4">
              {shareOptions.map((option) => (
                <button
                  key={option.name}
                  onClick={option.onClick}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors lg:flex-col lg:justify-center lg:gap-1.5 ${option.bg}`}
                >
                  <option.icon className={`w-5 h-5 shrink-0 ${option.color}`} />
                  <span className="text-sm font-medium text-foreground lg:text-xs lg:text-center lg:leading-tight">{option.name}</span>
                </button>
              ))}
            </div>

            {/* Share Preview */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">Preview:</p>
              <p className="text-xs sm:text-sm line-clamp-3">{shortShareText}</p>
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
