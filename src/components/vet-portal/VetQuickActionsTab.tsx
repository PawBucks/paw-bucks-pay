import { Button } from"@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from"@/components/ui/card";
import { FileText, Edit, Store, PlugZap, CalendarDays, Vault, ArrowRight, Receipt, Wallet, Megaphone } from "lucide-react";
import { useNavigate } from"react-router-dom";

type VetQuickActionsTabProps = {
 vetId: string;
 hasStripeAccount: boolean;
 onEditProfile?: () => void;
};

export function VetQuickActionsTab({
 vetId,
 hasStripeAccount,
 onEditProfile,
}: VetQuickActionsTabProps) {
 const navigate = useNavigate();

 const quickActions = [
 {
 title:"Invoicing",
 description:"Create and send professional invoices",
 icon: Receipt,
 onClick: () => navigate("/merchant/invoicing"),
 color:"text-primary",
 bgColor:"bg-primary/10",
 },
 {
 title:"Scheduling",
 description:"Manage appointments & bookings",
 icon: CalendarDays,
 onClick: () => navigate("/merchant/scheduling"),
 color:"text-accent",
 bgColor:"bg-accent/10",
 },
 {
 title:"Tax Vault",
 description:"Track business expenses for taxes",
 icon: Vault,
 onClick: () => navigate("/merchant/tax-vault"),
 color:"text-success",
 bgColor:"bg-success/10",
 },
 {
 title:"PawBucks Wallet",
 description:"Manage your PawBucks balance",
 icon: Wallet,
 onClick: () => navigate("/merchant/pawbucks"),
 color:"text-warning",
 bgColor:"bg-warning/10",
 },
 {
 title:"POS Integration",
 description:"Connect your POS system",
 icon: PlugZap,
 onClick: () => navigate("/merchant/pos-integration"),
 color:"text-info",
 bgColor:"bg-info/10",
 },
 {
 title:"Service Market",
 description:"Grow your practice with premium services",
 icon: Store,
 onClick: () => navigate("/merchant/market"),
 color:"text-primary",
 bgColor:"bg-primary/10",
 featured: true,
 },
 {
 title:"View Transactions",
 description:"See all your transaction history",
 icon: FileText,
 onClick: () => navigate("/merchant/transactions"),
 color:"text-info",
 bgColor:"bg-info/10",
 },
 {
 title:"Campaigns",
 description:"Send push, email & text campaigns",
 icon: Megaphone,
 onClick: () => navigate("/merchant/campaigns"),
 color:"text-destructive",
 bgColor:"bg-destructive/10",
 },
 ...(onEditProfile ? [{
 title:"Edit Practice Profile",
 description:"Update your practice information",
 icon: Edit,
 onClick: onEditProfile,
 color:"text-warning",
 bgColor:"bg-warning/10",
 }] : []),
 ];

 return (
 <div className="space-y-6">
 <div>
 <h2 className="text-3xl font-bold">Quick Actions</h2>
 <p className="text-muted-foreground">Access all practice tools and features</p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {quickActions.map((action) => {
 const Icon = action.icon;
 return (
 <Card 
 key={action.title} 
 className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/30 ${action.featured ?'border-primary/30 bg-primary/5' :''}`}
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
 <CardTitle className={`text-base mb-1 ${action.featured ? action.color :''}`}>
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
