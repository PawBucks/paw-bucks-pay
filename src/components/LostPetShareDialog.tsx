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
    const smsBody = encodeURIComponent(`${shortShareText} ${shareUrl}`);
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

  const handlePrint = () => {
    // Create a printable version of the flyer
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: "Please allow popups to print", variant: "destructive" });
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lost Pet Flyer - ${post.pet_name}</title>
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
            <h1>🚨 LOST ${post.pet_type.toUpperCase()} 🚨</h1>
            <div class="pet-name">${post.pet_name}</div>
          </div>
          
          <div class="photo">
            ${post.photo_url 
              ? `<img src="${post.photo_url}" alt="${post.pet_name}" />` 
              : `<div class="no-photo">No Photo Available</div>`
            }
          </div>
          
          <div class="details">
            <p><strong>📍 Last Seen:</strong> ${post.last_seen_location}</p>
            <p><strong>📅 Date:</strong> ${new Date(post.last_seen_date).toLocaleDateString()}</p>
            ${post.breed ? `<p><strong>🐾 Breed:</strong> ${post.breed}</p>` : ''}
            <p><strong>🎨 Color/Markings:</strong> ${post.color_markings}</p>
          </div>
          
          ${post.reward_amount ? `
            <div class="reward">
              💰 REWARD: $${post.reward_amount}
            </div>
          ` : ''}
          
          <div class="contact">
            <strong>PLEASE CONTACT:</strong><br/>
            📞 ${post.contact_phone}
            ${post.contact_email ? `<br/>📧 ${post.contact_email}` : ''}
          </div>
          
          <div class="footer">
            <p>Please help bring ${post.pet_name} home! Share this flyer with friends and neighbors.</p>
            <p>View online: ${shareUrl}</p>
          </div>
          
          <div class="tear-off">
            ${Array(5).fill(null).map(() => `
              <div class="tear-strip">
                LOST: ${post.pet_name}<br/>
                📞 ${post.contact_phone}
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Share {post.pet_name}'s Flyer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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

          {/* Share Options Grid */}
          <div className="grid grid-cols-2 gap-3">
            {shareOptions.map((option) => (
              <button
                key={option.name}
                onClick={option.onClick}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg transition-colors ${option.bg}`}
              >
                <option.icon className={`w-6 h-6 ${option.color}`} />
                <span className="text-sm font-medium text-foreground">{option.name}</span>
              </button>
            ))}
          </div>

          {/* Share Preview */}
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Preview:</p>
            <p className="text-sm line-clamp-3">{shortShareText}</p>
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
              className="shrink-0"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
