import { useState, useEffect } from"react";
import { useAuth } from"@/hooks/useAuth";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { Badge } from"@/components/ui/badge";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import { Facebook, Instagram, Twitter, Linkedin, Globe, Info } from"lucide-react";
import { PolicyDocumentUpload } from"./PolicyDocumentUpload";
import { BusinessHoursEditor } from"./BusinessHoursEditor";

import { Formatters } from "@/utils/formatters";
const BUSINESS_TYPE_OPTIONS: { key: string; label: string }[] = [
 { key:"veterinary", label:"Veterinary" },
 { key:"grooming", label:"Grooming" },
 { key:"mobile_groomer", label:"Mobile Groomer" },
 { key:"pet_store", label:"Pet Store" },
 { key:"food", label:"Food & Treats" },
 { key:"boarding", label:"Boarding" },
 { key:"training", label:"Training" },
 { key:"walker", label:"Walker" },
 { key:"daycare", label:"Daycare" },
 { key:"sitter", label:"Pet Sitter" },
 { key:"photography", label:"Photography" },
 { key:"insurance", label:"Insurance" },
 { key:"delivery", label:"Transportation" },
 { key:"hiker", label:"Hiker" },
 { key:"runner", label:"Runner" },
 { key:"masseuse", label:"Masseuse" },
 { key:"behaviorist", label:"Behaviorist" },
 { key:"breeder", label:"Breeder" },
 { key:"rescue_nonprofit", label:"Rescue / Nonprofit" },
 { key:"other", label:"Other" },
];

type Merchant = {
 id: string;
 business_name: string;
 contact_person: string;
 phone?: string;
 business_type: string;
 business_categories?: string[] | null;
 address?: string;
 description?: string;
 cashback_rate: number;
 logo_url?: string;
 facebook_url?: string;
 instagram_url?: string;
 twitter_url?: string;
 linkedin_url?: string;
 website_url?: string;
 tos_url?: string | null;
 privacy_policy_url?: string | null;
 shipping_returns_policy_url?: string | null;
};

type EditMerchantProfileDialogProps = {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 merchant: Merchant;
 onSubmit: (formData: FormData, logoFile: File | null, businessCategories: string[]) => Promise<void>;
 onRefresh?: () => void;
};

export const EditMerchantProfileDialog = ({
 open,
 onOpenChange,
 merchant,
 onSubmit,
 onRefresh,
}: EditMerchantProfileDialogProps) => {
 const { user } = useAuth();
 const [logoFile, setLogoFile] = useState<File | null>(null);
 const [logoPreview, setLogoPreview] = useState<string | null>(null);
 const [logoZoom, setLogoZoom] = useState(1);
 const [categories, setCategories] = useState<string[]>([]);

 useEffect(() => {
 const initial = (merchant.business_categories && merchant.business_categories.length > 0)
 ? merchant.business_categories
 : (merchant.business_type ? [merchant.business_type] : []);
 setCategories(initial);
 }, [merchant.business_categories, merchant.business_type, open]);

 const toggleCategory = (key: string) => {
 setCategories((prev) =>
 prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
 );
 };

 const primary = categories[0] || merchant.business_type;

 const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) {
 setLogoFile(file);
 const reader = new FileReader();
 reader.onloadend = () => {
 setLogoPreview(reader.result as string);
 };
 reader.readAsDataURL(file);
 }
 };

 const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 const formData = new FormData(e.currentTarget);
 // Use the first selected category as the primary business_type
 if (primary) formData.set("businessType", primary);
 await onSubmit(formData, logoFile, categories);
 setLogoFile(null);
 setLogoPreview(null);
 };

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
 <DialogHeader>
 <DialogTitle>Edit Business Profile</DialogTitle>
 <DialogDescription>Update your business information</DialogDescription>
 </DialogHeader>
 <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
 <div className="overflow-y-auto flex-1 space-y-4 pr-2">
 <div className="space-y-2">
 <Label htmlFor="businessName">Business Name</Label>
 <Input
 id="businessName"
 name="businessName"
 defaultValue={merchant.business_name}
 required
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="contactPerson">Contact Person</Label>
 <Input
 id="contactPerson"
 name="contactPerson"
 defaultValue={merchant.contact_person}
 required
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="phone">Phone Number</Label>
 <Input
 id="phone"
 name="phone"
 type="tel"
 placeholder="(310) 555-1234"
 defaultValue={merchant.phone ||""}
 />
 </div>

 <div className="space-y-2">
 <Label>Business Categories</Label>
 <p className="text-xs text-muted-foreground flex items-center gap-1.5">
 <Info className="w-3.5 h-3.5" />
 Select all that apply. The first selected becomes your primary category.
 </p>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
 {BUSINESS_TYPE_OPTIONS.map(({ key, label }) => {
 const isSelected = categories.includes(key);
 const isPrimary = primary === key && categories.length > 1;
 return (
 <button
 key={key}
 type="button"
 onClick={() => toggleCategory(key)}
 className={`relative px-3 py-2 rounded-lg border-2 text-sm text-left transition-all ${
 isSelected
 ?"border-primary bg-primary/10 text-foreground"
 :"border-border hover:border-primary hover:bg-muted text-muted-foreground"
 }`}
 >
 {label}
 {isPrimary && (
 <Badge className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0 h-4">
 Primary
 </Badge>
 )}
 </button>
 );
 })}
 </div>
 {categories.length > 0 && (
 <p className="text-xs text-muted-foreground">
 {categories.length} {categories.length === 1 ?"category" :"categories"} selected
 </p>
 )}
 {/* Hidden input to keep backward-compat with form consumers */}
 <input type="hidden" name="businessType" value={primary ||""} />
 </div>

 <div className="space-y-2">
 <Label htmlFor="logo">Business Logo</Label>
 <div className="flex flex-col gap-4">
 <Input
 id="logo"
 type="file"
 accept="image/*"
 onChange={handleLogoChange}
 />
 {(logoPreview || merchant.logo_url) && (
 <div className="space-y-3">
 <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-border mx-auto relative">
 <div
 className="absolute inset-0 flex items-center justify-center"
 style={{
 transform: `scale(${logoZoom})`,
 transition:"transform 0.2s ease",
 }}
 >
 <img
 src={logoPreview || merchant.logo_url ||""}
 alt="Logo preview"
 className="w-full h-full object-cover"
 />
 </div>
 </div>
 {logoPreview && (
 <div className="space-y-2">
 <Label htmlFor="logoZoom" className="text-sm">
 Adjust Logo Size
 </Label>
 <input
 id="logoZoom"
 type="range"
 min="0.5"
 max="2"
 step="0.1"
 value={logoZoom}
 onChange={(e) => setLogoZoom(parseFloat(e.target.value))}
 className="w-full"
 />
 <p className="text-xs text-muted-foreground text-center">
 Scale: {Formatters.decimal(logoZoom, 1)}x
 </p>
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 <div className="space-y-2">
 <Label htmlFor="address">Address</Label>
 <Input
 id="address"
 name="address"
 defaultValue={merchant.address ||""}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="description">Description</Label>
 <Textarea
 id="description"
 name="description"
 defaultValue={merchant.description ||""}
 rows={3}
 />
 </div>

 {/* Website Section */}
 <div className="space-y-3 pt-4 border-t">
 <Label className="text-base font-semibold">Website</Label>
 <div className="flex items-center gap-3">
 <Globe className="w-5 h-5 text-muted-foreground flex-shrink-0" />
 <Input
 id="websiteUrl"
 name="websiteUrl"
 placeholder="https://www.yourbusiness.com"
 defaultValue={merchant.website_url ||""}
 />
 </div>
 </div>

 {/* Social Media Section */}
 <div className="space-y-4 pt-4 border-t">
 <Label className="text-base font-semibold">Social Media Links</Label>
 <p className="text-sm text-muted-foreground">
 Add your social media profiles so customers can follow you
 </p>
 
 <div className="space-y-3">
 <div className="flex items-center gap-3">
 <Facebook className="w-5 h-5 text-[#1877F2] flex-shrink-0" />
 <Input
 id="facebookUrl"
 name="facebookUrl"
 placeholder="https://facebook.com/yourbusiness"
 defaultValue={merchant.facebook_url ||""}
 />
 </div>
 
 <div className="flex items-center gap-3">
 <Instagram className="w-5 h-5 text-[#E4405F] flex-shrink-0" />
 <Input
 id="instagramUrl"
 name="instagramUrl"
 placeholder="https://instagram.com/yourbusiness"
 defaultValue={merchant.instagram_url ||""}
 />
 </div>
 
 <div className="flex items-center gap-3">
 <Twitter className="w-5 h-5 flex-shrink-0" />
 <Input
 id="twitterUrl"
 name="twitterUrl"
 placeholder="https://x.com/yourbusiness"
 defaultValue={merchant.twitter_url ||""}
 />
 </div>
 
 <div className="flex items-center gap-3">
 <Linkedin className="w-5 h-5 text-[#0A66C2] flex-shrink-0" />
 <Input
 id="linkedinUrl"
 name="linkedinUrl"
 placeholder="https://linkedin.com/company/yourbusiness"
 defaultValue={merchant.linkedin_url ||""}
 />
 </div>
 </div>
 </div>
 </div>

 {/* Hours of Operation */}
 <BusinessHoursEditor merchantId={merchant.id} />

 {/* Policy Documents Section */}
 {user && (
 <PolicyDocumentUpload
 userId={user.id}
 entityId={merchant.id}
 entityType="merchant"
 tosUrl={merchant.tos_url}
 privacyPolicyUrl={merchant.privacy_policy_url}
 shippingReturnsPolicyUrl={merchant.shipping_returns_policy_url}
 onUpdate={() => onRefresh?.()}
 />
 )}
 <div className="flex gap-3 pt-4 border-t mt-4">
 <Button
 type="button"
 variant="outline"
 onClick={() => onOpenChange(false)}
 className="flex-1"
 >
 Cancel
 </Button>
 <Button type="submit" className="flex-1" disabled={categories.length === 0}>
 Save Changes
 </Button>
 </div>
 </form>
 </DialogContent>
 </Dialog>
 );
};
