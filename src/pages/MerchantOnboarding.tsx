import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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
  const [isLoading, setIsLoading] = useState(false);
  const [businessType, setBusinessType] = useState("pet_store");
  const [profile, setProfile] = useState<any>(null);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const businessName = formData.get("businessName") as string;
      const contactPerson = formData.get("contactPerson") as string;
      const address = formData.get("address") as string;
      const description = formData.get("description") as string;

      // Validate input
      const validatedData = merchantOnboardingSchema.parse({
        businessName,
        contactPerson,
        businessType,
        address: address || "",
        description: description || "",
        cashbackRate: 10.0, // Default rate, not user-configurable
      });

      // Create merchant profile
      const { error: merchantError } = await supabase.from("merchants").insert({
        user_id: user.id,
        business_name: validatedData.businessName,
        contact_person: validatedData.contactPerson,
        business_type: validatedData.businessType,
        address: validatedData.address || null,
        description: validatedData.description || null,
        cashback_rate: validatedData.cashbackRate,
      });

      if (merchantError) throw merchantError;

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

            {/* Business Type */}
            <div className="space-y-2">
              <Label htmlFor="businessType">Type of Business *</Label>
              <Select value={businessType} onValueChange={setBusinessType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pet_store">Pet Store</SelectItem>
                  <SelectItem value="groomer">Groomer</SelectItem>
                  <SelectItem value="trainer">Trainer</SelectItem>
                  <SelectItem value="veterinarian">Veterinarian</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Business Address</Label>
              <Input
                id="address"
                name="address"
                placeholder="123 Pet Street, City, State 12345"
              />
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