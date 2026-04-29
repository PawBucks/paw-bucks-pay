import { useParams } from"react-router-dom";
import { Card, CardContent } from"@/components/ui/card";
import { CheckCircle } from"lucide-react";
import logo from"@/assets/logo.png";

export default function AdminInvoicePaymentSuccess() {
 const { invoiceId } = useParams();

 return (
 <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
 <div className="max-w-md w-full space-y-6 text-center">
 <img src={logo} alt="PawBucks" className="h-16 mx-auto" />
 <Card>
 <CardContent className="pt-8 pb-6 space-y-4">
 <CheckCircle className="w-16 h-16 text-success mx-auto" />
 <h1 className="text-2xl font-bold">Payment Successful!</h1>
 <p className="text-muted-foreground">
 Your payment has been processed successfully. You will receive a confirmation email shortly.
 </p>
 </CardContent>
 </Card>
 <p className="text-xs text-muted-foreground">Powered by PawBucks</p>
 </div>
 </div>
 );
}
