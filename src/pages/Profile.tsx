import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BottomNav } from "@/components/BottomNav";
import { LogOut, User, Mail, Calendar } from "lucide-react";
import { toast } from "sonner";

type Profile = {
  full_name: string;
  email: string;
  user_type: string;
  created_at: string;
};

const Profile = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (loading || authLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-[var(--gradient-hero)] pb-24">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Profile</h1>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>

        {/* Profile Card */}
        <GradientCard gradient className="mb-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <Avatar className="w-24 h-24 bg-primary/20 border-4 border-background">
              <AvatarFallback className="text-2xl font-bold text-primary-foreground bg-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-bold">{profile.full_name}</h2>
              <p className="text-sm text-muted-foreground capitalize">
                {profile.user_type.replace("_", " ")}
              </p>
            </div>
          </div>
        </GradientCard>

        {/* Information Cards */}
        <div className="space-y-4">
          <GradientCard>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <p className="font-medium">{profile.email}</p>
              </div>
            </div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-secondary" />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Account Type</Label>
                <p className="font-medium capitalize">
                  {profile.user_type.replace("_", " ")}
                </p>
              </div>
            </div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-accent" />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Member Since</Label>
                <p className="font-medium">
                  {new Date(profile.created_at).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </GradientCard>
        </div>

        {/* Actions */}
        <div className="mt-8 space-y-3">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigate("/dashboard")}
          >
            Go to Dashboard
          </Button>
          <Button 
            variant="destructive" 
            className="w-full"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Profile;
