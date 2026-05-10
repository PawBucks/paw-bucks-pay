import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";

type PendingApprovalNoticeProps = {
 entityType:'merchant' |'vet';
 approvalStatus:'pending' |'approved' |'denied' | string;
 denialReason?: string | null;
};

export function PendingApprovalNotice({ entityType, approvalStatus, denialReason }: PendingApprovalNoticeProps) {
 if (approvalStatus ==='approved') {
 return null;
 }

 const entityLabel = entityType ==='merchant' ?'Merchant' :'Veterinary Practice';

 if (approvalStatus ==='denied') {
 return (
 <Card className="border-destructive bg-destructive/5">
 <CardHeader className="pb-3">
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
 <XCircle className="w-6 h-6 text-destructive" />
 </div>
 <div>
 <CardTitle className="text-lg text-destructive">Application Denied</CardTitle>
 <CardDescription>
 Your {entityLabel.toLowerCase()} application was not approved
 </CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent className="space-y-4">
 {denialReason && (
 <div className="p-3 bg-destructive/10 rounded-lg">
 <p className="text-sm font-medium text-destructive mb-1">Reason:</p>
 <p className="text-sm text-muted-foreground">{denialReason}</p>
 </div>
 )}
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <span className="w-4 h-4" aria-hidden="true">📧</span>
 <span>Please contact <a href="mailto:support@pawbucks.app" className="text-primary hover:underline">support@pawbucks.app</a> for more information.</span>
 </div>
 </CardContent>
 </Card>
 );
 }

 // Pending status
 return (
 <Card className="border-warning bg-warning/5">
 <CardHeader className="pb-3">
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center animate-pulse">
 <span className="w-6 h-6 text-warning" aria-hidden="true">⏰</span>
 </div>
 <div className="flex-1">
 <div className="flex items-center gap-2">
 <CardTitle className="text-lg">Pending Approval</CardTitle>
 <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
 Under Review
 </Badge>
 </div>
 <CardDescription>
 Your {entityLabel.toLowerCase()} account is awaiting admin approval
 </CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
 <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
 <div>
 <p className="text-sm font-medium">Profile Submitted</p>
 <p className="text-xs text-muted-foreground">Your information has been received</p>
 </div>
 </div>
 <div className="flex items-start gap-3 p-3 bg-warning/5 rounded-lg border border-warning/30">
 <span className="w-5 h-5 text-warning mt-0.5" aria-hidden="true">⏰</span>
 <div>
 <p className="text-sm font-medium text-warning">Admin Review</p>
 <p className="text-xs text-muted-foreground">Typically takes 1-2 business days</p>
 </div>
 </div>
 <div className="flex items-start gap-3 p-3 bg-muted rounded-lg border border-dashed">
 <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
 <div>
 <p className="text-sm font-medium text-muted-foreground">Full Access</p>
 <p className="text-xs text-muted-foreground">Available after approval</p>
 </div>
 </div>
 </div>
 
 <div className="p-4 bg-muted/30 rounded-lg">
 <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
 <AlertCircle className="w-4 h-4 text-warning" />
 Limited Access Mode
 </h4>
 <p className="text-sm text-muted-foreground">
 While pending approval, you have limited access to the dashboard. 
 {entityType ==='merchant' 
 ?' You cannot accept payments or appear in the merchant directory until approved.'
 :' Patient management and billing features are restricted until approved.'}
 </p>
 </div>

 <p className="text-xs text-muted-foreground text-center">
 Questions? Contact <a href="mailto:support@pawbucks.app" className="text-primary hover:underline">support@pawbucks.app</a>
 </p>
 </CardContent>
 </Card>
 );
}
