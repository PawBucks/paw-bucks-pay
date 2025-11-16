import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, ArrowLeft, Home } from "lucide-react";
import { SEO } from "@/components/SEO";

const CheckoutSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    // Optional: You could fetch the session details here to show order information
    // const fetchSessionDetails = async () => {
    //   if (sessionId) {
    //     // Call an edge function to retrieve session details
    //   }
    // };
    // fetchSessionDetails();
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <SEO 
        title="Payment Successful"
        description="Your payment was processed successfully"
      />

      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          <CardDescription>
            Your order has been confirmed and is being processed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessionId && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Session ID</p>
              <p className="text-sm font-mono break-all">{sessionId}</p>
            </div>
          )}
          
          <div className="text-center text-sm text-muted-foreground">
            <p>You will receive a confirmation email shortly.</p>
          </div>

          <div className="flex flex-col gap-2 pt-4">
            <Button onClick={() => navigate("/")} className="w-full">
              <Home className="h-4 w-4 mr-2" />
              Return to Home
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate(-2)} 
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Store
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckoutSuccess;
