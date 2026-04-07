import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { buildAppUrl } from "@/lib/url";

interface LostPetData {
  pet_name: string;
  pet_type: string;
  breed: string | null;
  color_markings: string;
  size?: string | null;
  gender?: string | null;
  last_seen_location: string;
  last_seen_date: string;
  contact_phone: string;
  contact_email: string | null;
  reward_amount: number | null;
  photo_url: string | null;
  identifying_features?: string | null;
}

interface HighReadabilityFlyerProps {
  post: LostPetData;
  shareUrl?: string;
}

// HTML escape function to prevent XSS
const escapeHtml = (text: string | null | undefined): string => {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

export const generateHighReadabilityFlyer = (post: LostPetData, shareUrl: string): string => {
  // Escape all user-supplied data
  const safePetName = escapeHtml(post.pet_name);
  const safePetType = escapeHtml(post.pet_type);
  const safeLastSeenLocation = escapeHtml(post.last_seen_location);
  const safeBreed = escapeHtml(post.breed);
  const safeColorMarkings = escapeHtml(post.color_markings);
  const safeContactPhone = escapeHtml(post.contact_phone);
  const safeContactEmail = escapeHtml(post.contact_email);
  const safePhotoUrl = escapeHtml(post.photo_url);
  const safeIdentifyingFeatures = escapeHtml(post.identifying_features);
  const safeSize = escapeHtml(post.size);
  const safeGender = escapeHtml(post.gender);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>LOST PET - ${safePetName}</title>
        <style>
          @page {
            size: letter portrait;
            margin: 0.5in;
          }
          @media print {
            body { 
              margin: 0; 
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: 'Arial Black', 'Helvetica Neue', Arial, sans-serif;
            max-width: 8.5in;
            margin: 0 auto;
            padding: 0.25in;
            background: white;
          }
          
          /* HEADER - Maximum Impact */
          .header {
            background: linear-gradient(135deg, #dc2626, #b91c1c);
            color: white;
            text-align: center;
            padding: 20px 15px;
            border-radius: 12px;
            margin-bottom: 15px;
            box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
          }
          .header-label {
            font-size: 72px;
            font-weight: 900;
            letter-spacing: 8px;
            text-transform: uppercase;
            text-shadow: 3px 3px 0 rgba(0,0,0,0.2);
            line-height: 1;
          }
          .header-emoji {
            font-size: 48px;
            margin: 0 10px;
          }
          
          /* PET NAME - Largest, Most Prominent */
          .pet-name-section {
            text-align: center;
            margin: 15px 0;
          }
          .pet-name {
            font-size: 84px;
            font-weight: 900;
            color: #1a1a1a;
            text-transform: uppercase;
            letter-spacing: 4px;
            line-height: 1.1;
            text-shadow: 2px 2px 0 #e5e5e5;
          }
          .pet-type-badge {
            display: inline-block;
            background: #f59e0b;
            color: white;
            font-size: 24px;
            font-weight: 700;
            padding: 8px 24px;
            border-radius: 50px;
            margin-top: 8px;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
          
          /* PHOTO - Clear and Large */
          .photo-section {
            text-align: center;
            margin: 20px 0;
          }
          .photo-container {
            display: inline-block;
            border: 8px solid #1a1a1a;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          }
          .photo-container img {
            width: 400px;
            height: 350px;
            object-fit: cover;
            display: block;
          }
          .no-photo {
            width: 400px;
            height: 300px;
            background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #6b7280;
            font-size: 24px;
            font-weight: 700;
          }
          .no-photo-icon {
            font-size: 72px;
            margin-bottom: 10px;
          }
          
          /* DESCRIPTION - Quick Visual Scan */
          .description-bar {
            display: flex;
            justify-content: center;
            gap: 15px;
            flex-wrap: wrap;
            margin: 20px 0;
          }
          .desc-tag {
            background: #1a1a1a;
            color: white;
            font-size: 22px;
            font-weight: 700;
            padding: 12px 20px;
            border-radius: 8px;
            text-transform: uppercase;
          }
          
          /* LAST SEEN - Critical Info */
          .last-seen {
            background: #fef3c7;
            border: 4px solid #f59e0b;
            border-radius: 12px;
            padding: 20px;
            margin: 15px 0;
            text-align: center;
          }
          .last-seen-label {
            font-size: 28px;
            font-weight: 700;
            color: #92400e;
            margin-bottom: 8px;
          }
          .last-seen-location {
            font-size: 36px;
            font-weight: 900;
            color: #1a1a1a;
            line-height: 1.2;
          }
          .last-seen-date {
            font-size: 22px;
            color: #78350f;
            margin-top: 8px;
            font-weight: 600;
          }
          
          /* CONTACT - Most Prominent After Name/Photo */
          .contact-section {
            background: linear-gradient(135deg, #16a34a, #15803d);
            border-radius: 12px;
            padding: 25px;
            margin: 15px 0;
            text-align: center;
            box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3);
          }
          .contact-label {
            color: rgba(255,255,255,0.9);
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 3px;
          }
          .phone-number {
            font-size: 56px;
            font-weight: 900;
            color: white;
            letter-spacing: 4px;
            text-shadow: 2px 2px 0 rgba(0,0,0,0.2);
          }
          .email {
            font-size: 22px;
            color: rgba(255,255,255,0.9);
            margin-top: 8px;
          }
          
          /* REWARD */
          .reward-section {
            background: linear-gradient(135deg, #7c3aed, #6d28d9);
            color: white;
            text-align: center;
            padding: 20px;
            border-radius: 12px;
            margin: 15px 0;
          }
          .reward-label {
            font-size: 24px;
            font-weight: 600;
            opacity: 0.9;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
          .reward-amount {
            font-size: 64px;
            font-weight: 900;
            text-shadow: 2px 2px 0 rgba(0,0,0,0.2);
          }
          
          /* IDENTIFYING FEATURES */
          .features-section {
            background: #f3f4f6;
            border-radius: 12px;
            padding: 15px 20px;
            margin: 15px 0;
          }
          .features-label {
            font-size: 18px;
            font-weight: 700;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
          }
          .features-text {
            font-size: 20px;
            color: #1a1a1a;
            line-height: 1.4;
            font-weight: 600;
          }
          
          /* TEAR-OFF STRIPS */
          .tear-off-container {
            border-top: 3px dashed #9ca3af;
            padding-top: 15px;
            margin-top: 25px;
          }
          .tear-off-label {
            text-align: center;
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 10px;
            font-weight: 600;
          }
          .tear-off {
            display: flex;
            justify-content: space-between;
          }
          .tear-strip {
            writing-mode: vertical-rl;
            text-orientation: mixed;
            border: 2px solid #1a1a1a;
            padding: 10px 6px;
            font-size: 14px;
            font-weight: 700;
            text-align: center;
            background: white;
            border-radius: 4px;
          }
          .tear-strip-name {
            color: #dc2626;
            font-size: 16px;
            display: block;
            margin-bottom: 5px;
          }
          .tear-strip-phone {
            color: #1a1a1a;
            font-size: 14px;
          }
          
          /* QR Code placeholder */
          .qr-section {
            text-align: center;
            margin-top: 10px;
          }
          .qr-text {
            font-size: 12px;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <!-- HEADER -->
        <div class="header">
          <div class="header-label">
            <span class="header-emoji">🚨</span>LOST<span class="header-emoji">🚨</span>
          </div>
        </div>
        
        <!-- PET NAME - Maximum Size -->
        <div class="pet-name-section">
          <div class="pet-name">${safePetName}</div>
          <div class="pet-type-badge">${safePetType}</div>
        </div>
        
        <!-- PHOTO -->
        <div class="photo-section">
          <div class="photo-container">
            ${safePhotoUrl 
              ? `<img src="${safePhotoUrl}" alt="${safePetName}" />` 
              : `<div class="no-photo">
                  <div class="no-photo-icon">🐾</div>
                  No Photo Available
                </div>`
            }
          </div>
        </div>
        
        <!-- DESCRIPTION TAGS -->
        <div class="description-bar">
          ${safeBreed ? `<span class="desc-tag">${safeBreed}</span>` : ''}
          <span class="desc-tag">${safeColorMarkings}</span>
          ${safeSize ? `<span class="desc-tag">${safeSize}</span>` : ''}
          ${safeGender && safeGender !== 'unknown' ? `<span class="desc-tag">${safeGender}</span>` : ''}
        </div>
        
        <!-- IDENTIFYING FEATURES -->
        ${safeIdentifyingFeatures ? `
          <div class="features-section">
            <div class="features-label">🔍 Identifying Features</div>
            <div class="features-text">${safeIdentifyingFeatures}</div>
          </div>
        ` : ''}
        
        <!-- LAST SEEN -->
        <div class="last-seen">
          <div class="last-seen-label">📍 LAST SEEN</div>
          <div class="last-seen-location">${safeLastSeenLocation}</div>
          <div class="last-seen-date">${new Date(post.last_seen_date).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</div>
        </div>
        
        <!-- REWARD -->
        ${post.reward_amount ? `
          <div class="reward-section">
            <div class="reward-label">💰 Reward Offered</div>
            <div class="reward-amount">$${post.reward_amount}</div>
          </div>
        ` : ''}
        
        <!-- CONTACT - Maximum Visibility -->
        <div class="contact-section">
          <div class="contact-label">📞 If Found, Please Call</div>
          <div class="phone-number">${safeContactPhone}</div>
          ${safeContactEmail ? `<div class="email">📧 ${safeContactEmail}</div>` : ''}
        </div>
        
        <!-- TEAR-OFF STRIPS -->
        <div class="tear-off-container">
          <div class="tear-off-label">✂️ TEAR OFF AND TAKE ✂️</div>
          <div class="tear-off">
            ${Array(7).fill(null).map(() => `
              <div class="tear-strip">
                <span class="tear-strip-name">LOST: ${safePetName}</span>
                <span class="tear-strip-phone">📞 ${safeContactPhone}</span>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="qr-section">
          <p class="qr-text">View online: ${shareUrl}</p>
        </div>
      </body>
    </html>
  `;
};

export const HighReadabilityFlyer = ({ post, shareUrl }: HighReadabilityFlyerProps) => {
  const { toast } = useToast();
  
  const handlePrint = () => {
    const url = shareUrl || buildAppUrl("/lost-pets/preview");
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      toast({ title: "Please allow popups to print", variant: "destructive" });
      return;
    }

    printWindow.document.write(generateHighReadabilityFlyer(post, url));
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Button onClick={handlePrint} variant="outline" className="gap-2">
      <Printer className="w-4 h-4" />
      Print High-Readability Flyer
    </Button>
  );
};
