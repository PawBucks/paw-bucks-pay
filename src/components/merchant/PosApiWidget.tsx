import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { GradientCard } from"@/components/ui/gradient-card";
import { Code, Key, Webhook, ExternalLink, Shield } from "lucide-react";
import { useNavigate } from"react-router-dom";

export function PosApiWidget() {
 const navigate = useNavigate();

 const features = [
 { icon: Key, title:"API Keys", description:"Generate and manage API keys for your POS system" },
 { icon: Webhook, title:"Webhooks", description:"Configure real-time event notifications" },
 { icon: Code, title:"REST API", description:"Full API documentation with code examples" },
 { icon: Shield, title:"Secure", description:"Enterprise-grade security with key rotation" },
 ];

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <h2 className="text-2xl font-bold">POS & API Integration</h2>
 <p className="text-muted-foreground">
 Connect your point-of-sale system to PawBucks for seamless reward tracking
 </p>
 </div>
 <Badge className="bg-gradient-to-r from-primary to-primary/60 gap-1 w-fit">
 <span className="h-3 w-3" aria-hidden="true">👑</span> Premium
 </Badge>
 </div>

 {/* Feature Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {features.map((feature) => (
 <GradientCard key={feature.title} gradient>
 <div className="flex items-start gap-4">
 <div className="p-3 rounded-md bg-primary/10">
 <feature.icon className="h-5 w-5 text-primary" />
 </div>
 <div>
 <h3 className="font-semibold">{feature.title}</h3>
 <p className="text-sm text-muted-foreground mt-1">{feature.description}</p>
 </div>
 </div>
 </GradientCard>
 ))}
 </div>

 {/* Quick Start */}
 <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <span className="h-5 w-5 text-primary" aria-hidden="true">⚡</span>
 Quick Start Guide
 </CardTitle>
 <CardDescription>Get your POS integration running in minutes</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-3">
 {[
"Generate an API key from the integration portal",
"Configure your webhook endpoint URL",
"Send a test transaction to verify connectivity",
"Go live and start awarding PawBucks automatically",
 ].map((step, i) => (
 <div key={i} className="flex items-center gap-3">
 <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
 {i + 1}
 </div>
 <p className="text-sm">{step}</p>
 </div>
 ))}
 </div>

 <Button onClick={() => navigate('/merchant/pos-integration')} className="w-full mt-4">
 <ExternalLink className="h-4 w-4 mr-2" />
 Open Full Integration Portal
 </Button>
 </CardContent>
 </Card>

 {/* API Status */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <span className="h-5 w-5" aria-hidden="true">📖</span>
 Integration Resources
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 <button 
 onClick={() => navigate('/merchant/pos-integration')}
 className="w-full flex items-center justify-between p-4 rounded-lg border hover:bg-muted transition-colors text-left"
 >
 <div className="flex items-center gap-3">
 <span className="h-5 w-5 text-muted-foreground" aria-hidden="true">🔑</span>
 <div>
 <p className="font-medium">API Key Management</p>
 <p className="text-sm text-muted-foreground">Create, rotate, and manage your API credentials</p>
 </div>
 </div>
 <ExternalLink className="h-4 w-4 text-muted-foreground" />
 </button>

 <button 
 onClick={() => navigate('/merchant/pos-integration')}
 className="w-full flex items-center justify-between p-4 rounded-lg border hover:bg-muted transition-colors text-left"
 >
 <div className="flex items-center gap-3">
 <Webhook className="h-5 w-5 text-muted-foreground" />
 <div>
 <p className="font-medium">Webhook Configuration</p>
 <p className="text-sm text-muted-foreground">Set up real-time notifications for POS events</p>
 </div>
 </div>
 <ExternalLink className="h-4 w-4 text-muted-foreground" />
 </button>

 <button 
 onClick={() => navigate('/merchant/pos-integration')}
 className="w-full flex items-center justify-between p-4 rounded-lg border hover:bg-muted transition-colors text-left"
 >
 <div className="flex items-center gap-3">
 <Code className="h-5 w-5 text-muted-foreground" />
 <div>
 <p className="font-medium">API Documentation</p>
 <p className="text-sm text-muted-foreground">Complete reference with code examples in multiple languages</p>
 </div>
 </div>
 <ExternalLink className="h-4 w-4 text-muted-foreground" />
 </button>
 </CardContent>
 </Card>
 </div>
 );
}
