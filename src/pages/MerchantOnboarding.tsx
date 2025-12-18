import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGeocoding } from "@/hooks/useGeocoding";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Store, Loader2, PawPrint } from "lucide-react";
import { merchantOnboardingSchema } from "@/lib/validation";

const MerchantOnboarding = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { geocodeAddress } = useGeocoding();
  const [isLoading, setIsLoading] = useState(false);
  const [businessType, setBusinessType] = useState("dog_walker");
  const [profile, setProfile] = useState<any>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoZoom, setLogoZoom] = useState(1);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      checkProfile();
    }
  }, [user]);

  const checkProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    setProfile(data);

    // Check if merchant profile already exists
    if (data?.user_type === "merchant") {
      const { data: merchantData } = await supabase
        .from("merchants")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (merchantData) {
        navigate("/merchant-dashboard");
      }
    }
  };

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
    if (!user) return;

    setIsLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const businessName = formData.get("businessName") as string;
      const contactPerson = formData.get("contactPerson") as string;
      const phone = formData.get("phone") as string;
      const streetAddress = formData.get("streetAddress") as string;
      const city = formData.get("city") as string;
      const state = formData.get("state") as string;
      const zipCode = formData.get("zipCode") as string;
      const description = formData.get("description") as string;

      // Upload logo if provided
      let logoUrl: string | null = null;
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('merchant-logos')
          .upload(filePath, logoFile);

        if (uploadError) {
          throw new Error("Failed to upload logo");
        }

        const { data: urlData } = supabase.storage
          .from('merchant-logos')
          .getPublicUrl(filePath);
        
        logoUrl = urlData.publicUrl;
      }

      // Validate input
      const validatedData = merchantOnboardingSchema.parse({
        businessName,
        contactPerson,
        phone,
        businessType,
        streetAddress,
        city,
        state,
        zipCode,
        description: description || "",
        cashbackRate: 10.0, // Default rate, not user-configurable
      });

      // Combine address fields into full address
      const fullAddress = `${validatedData.streetAddress}, ${validatedData.city}, ${validatedData.state} ${validatedData.zipCode}`;

      // Update profile to merchant type if needed
      if (profile?.user_type !== "merchant") {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ user_type: "merchant" })
          .eq("id", user.id);

        if (profileError) {
          console.error("Error updating profile:", profileError);
          throw new Error("Failed to update account type");
        }
      }

      // Generate storefront slug from business name
      const storefrontSlug = validatedData.businessName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

      // Create merchant profile
      const { data: merchantData, error: merchantError } = await supabase.from("merchants").insert({
        user_id: user.id,
        business_name: validatedData.businessName,
        contact_person: validatedData.contactPerson,
        phone: validatedData.phone,
        business_type: validatedData.businessType,
        address: fullAddress,
        description: validatedData.description || null,
        cashback_rate: validatedData.cashbackRate,
        logo_url: logoUrl,
        storefront_slug: storefrontSlug,
      }).select('id').single();

      if (merchantError) {
        console.error("Error creating merchant:", merchantError);
        throw new Error("Failed to create merchant profile");
      }

      // Geocode the address and update merchant with coordinates
      if (merchantData?.id) {
        geocodeAddress(fullAddress, merchantData.id).then(result => {
          if (result.latitude && result.longitude) {
            console.log(`Merchant geocoded: lat=${result.latitude}, lng=${result.longitude}`);
          } else {
            console.warn("Could not geocode merchant address:", result.error);
          }
        }).catch(err => {
          console.error("Geocoding error:", err);
        });
      }

      toast.success("Merchant profile created successfully!");
      navigate("/merchant-dashboard");
    } catch (error: any) {
      if (error.errors) {
        // Zod validation error
        toast.error(error.errors[0]?.message || "Invalid input");
      } else {
        toast.error("Failed to create merchant profile. Please try again.");
      }
      console.error("Error creating merchant profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-hero)] flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
              <Store className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">Set Up Your Business</CardTitle>
          <CardDescription>Complete your merchant profile to start receiving payments</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Business Name */}
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name *</Label>
              <Input
                id="businessName"
                name="businessName"
                placeholder="Paws & Claws Pet Store"
                required
              />
            </div>

            {/* Contact Person */}
            <div className="space-y-2">
              <Label htmlFor="contactPerson">Contact Person *</Label>
              <Input
                id="contactPerson"
                name="contactPerson"
                placeholder="John Doe"
                required
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="(310) 555-1234"
                required
              />
            </div>

            {/* Business Type */}
            <div className="space-y-2">
              <Label htmlFor="businessType">Type of Business *</Label>
              <Select value={businessType} onValueChange={setBusinessType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vet">Vet</SelectItem>
                  <SelectItem value="groomer">Groomer</SelectItem>
                  <SelectItem value="sitter">Sitter</SelectItem>
                  <SelectItem value="pet_store">Pet Store</SelectItem>
                  <SelectItem value="walker">Walker</SelectItem>
                  <SelectItem value="trainer">Trainer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Business Logo */}
            <div className="space-y-2">
              <Label htmlFor="logo">Business Logo</Label>
              <div className="flex flex-col gap-4">
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                />
                {logoPreview && (
                  <div className="space-y-3">
                    <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-border mx-auto relative">
                      <div 
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                          transform: `scale(${logoZoom})`,
                          transition: 'transform 0.2s ease'
                        }}
                      >
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="logoZoom" className="text-sm">Adjust Logo Size</Label>
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
                        Scale: {logoZoom.toFixed(1)}x
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Address Fields */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Business Address *</Label>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="streetAddress">Street Address</Label>
                  <Input
                    id="streetAddress"
                    name="streetAddress"
                    placeholder="123 Pet Street"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      name="city"
                      placeholder="Los Angeles"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      name="state"
                      placeholder="CA"
                      required
                    />
                  </div>
                </div>
                <div className="w-1/2">
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">ZIP Code</Label>
                    <Input
                      id="zipCode"
                      name="zipCode"
                      placeholder="90066"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Tell customers about your business..."
                rows={3}
              />
            </div>

            <div className="bg-muted rounded-lg p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <PawPrint className="w-4 h-4" />
                Banking Setup (Stripe Connect)
              </h3>
              <p className="text-sm text-muted-foreground">
                After creating your profile, you'll be able to connect your bank account through Stripe Connect
                to receive payments directly.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/dashboard")}
                className="flex-1"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Business Profile"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default MerchantOnboarding;