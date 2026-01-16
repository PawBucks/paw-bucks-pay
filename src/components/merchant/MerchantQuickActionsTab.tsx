import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  FileText,
  CreditCard,
  Edit,
  Package,
  ShoppingCart,
  Store,
  PlugZap,
  CalendarDays,
  Vault,
  ArrowRight,
} from "lucide-react";

type MerchantQuickActionsTabProps = {
  hasStripeAccount: boolean;
  fundingEligible: boolean;
  daysActive: number;
  onRequestFunding: () => void;
  onEditProfile: () => void;
  onNavigate: (path: string) => void;
};

export function MerchantQuickActionsTab({
  hasStripeAccount,
  fundingEligible,
  daysActive,
  onRequestFunding,
  onEditProfile,
  onNavigate,
}: MerchantQuickActionsTabProps) {
  const daysRemaining = Math.max(0, 90 - daysActive);
  const quickActions = [
    {
      title: "View Detailed Transactions",
      description: "See all your transaction activity",
      icon: FileText,
      onClick: () => onNavigate("/merchant/transactions"),
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Request Funding",
      description: fundingEligible 
        ? "Get an advance on your earnings" 
        : `${daysRemaining} more days until eligible`,
      icon: CreditCard,
      onClick: onRequestFunding,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Edit Profile",
      description: "Update your business information",
      icon: Edit,
      onClick: onEditProfile,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    ...(hasStripeAccount ? [{
      title: "Manage Products",
      description: "Add and edit your products",
      icon: Package,
      onClick: () => onNavigate("/merchant/products"),
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    }] : []),
    {
      title: "Partner Offers",
      description: "Manage PawBucks redemption offers",
      icon: ShoppingCart,
      onClick: () => onNavigate("/merchant/offers"),
      color: "text-pink-500",
      bgColor: "bg-pink-500/10",
    },
    {
      title: "Merchant Market",
      description: "Grow your business with premium services",
      icon: Store,
      onClick: () => onNavigate("/merchant/market"),
      color: "text-primary",
      bgColor: "bg-primary/10",
      featured: true,
    },
    {
      title: "POS Integration",
      description: "Connect your POS system",
      icon: PlugZap,
      onClick: () => onNavigate("/merchant/pos-integration"),
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
    },
    {
      title: "Scheduling",
      description: "Manage bookings & services",
      icon: CalendarDays,
      onClick: () => onNavigate("/merchant/scheduling"),
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Tax Vault",
      description: "Track business expenses for taxes",
      icon: Vault,
      onClick: () => onNavigate("/merchant/tax-vault"),
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Quick Actions</h2>
        <p className="text-muted-foreground">Access all merchant tools and features</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Card 
              key={action.title} 
              className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/30 ${action.featured ? 'border-primary/30 bg-primary/5' : ''}`}
              onClick={action.onClick}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className={`w-10 h-10 rounded-lg ${action.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${action.color}`} />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className={`text-base mb-1 ${action.featured ? action.color : ''}`}>
                  {action.title}
                </CardTitle>
                <CardDescription className="text-sm">
                  {action.description}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
