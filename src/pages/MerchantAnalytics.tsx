import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Users, Search, Check, CreditCard, Coins } from "lucide-react";
import { toast } from "sonner";
import { GradientCard } from "@/components/ui/gradient-card";
import { PremiumAnalyticsDashboard } from "@/components/merchant/PremiumAnalyticsDashboard";
import { CohortAnalysisReport } from "@/components/merchant/CohortAnalysisReport";
import { KeywordPerformanceWidget } from "@/components/merchant/KeywordPerformanceWidget";
import { DemandForecastingReport } from "@/components/merchant/DemandForecastingReport";

export default function MerchantAnalytics() {
  const [selectedPayment, setSelectedPayment] = useState<'usd' | 'pawbucks'>('usd');

  const { data: products } = useQuery({
    queryKey: ['analytics-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchant_analytics_products')
        .select('*')
        .eq('is_active', true)
        .order('price_usd', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: subscriptions } = useQuery({
    queryKey: ['my-analytics-subscriptions'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!merchant) throw new Error('Merchant not found');

      const { data, error } = await supabase
        .from('merchant_analytics_subscriptions')
        .select('*, merchant_analytics_products(*)')
        .eq('merchant_id', merchant.id)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString());
      
      if (error) throw error;
      return data;
    }
  });

  const { data: purchases } = useQuery({
    queryKey: ['my-analytics-purchases'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!merchant) throw new Error('Merchant not found');

      const { data, error } = await supabase
        .from('merchant_analytics_purchases')
        .select('*, merchant_analytics_products(*)')
        .eq('merchant_id', merchant.id)
        .order('purchase_date', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const handlePurchase = async (productId: string, productType: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('merchant-purchase-analytics', {
        body: { product_id: productId, payment_method: selectedPayment }
      });

      if (error) throw error;

      if (data.checkout_url) {
        window.open(data.checkout_url, '_blank');
      } else {
        toast.success(productType === 'subscription' ? 'Subscription activated!' : 'Report purchased!');
        window.location.reload();
      }
    } catch (error: any) {
      toast.error(error.message || 'Purchase failed');
    }
  };

  const getIcon = (name: string) => {
    if (name.includes('Premium Analytics')) return BarChart3;
    if (name.includes('Cohort')) return Users;
    if (name.includes('Forecasting')) return TrendingUp;
    if (name.includes('Keyword')) return Search;
    return BarChart3;
  };

  const hasActiveSubscription = (productName: string) => {
    return subscriptions?.some(s => s.merchant_analytics_products.name === productName);
  };

  const hasPurchased = (productName: string) => {
    return purchases?.some(p => p.merchant_analytics_products.name === productName);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="container mx-auto px-4 pt-24 pb-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Business Intelligence & Analytics</h1>
          <p className="text-muted-foreground">
            Unlock powerful insights to grow your business
          </p>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="forecasting">Forecasting</TabsTrigger>
            <TabsTrigger value="cohorts">Cohort Analysis</TabsTrigger>
            <TabsTrigger value="keywords">Keywords</TabsTrigger>
            <TabsTrigger value="products">Available Products</TabsTrigger>
            <TabsTrigger value="subscriptions">My Subscriptions</TabsTrigger>
            <TabsTrigger value="reports">My Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <PremiumAnalyticsDashboard />
          </TabsContent>

          <TabsContent value="forecasting">
            <DemandForecastingReport />
          </TabsContent>

          <TabsContent value="cohorts">
            <CohortAnalysisReport />
          </TabsContent>

          <TabsContent value="keywords">
            <KeywordPerformanceWidget />
          </TabsContent>

          <TabsContent value="products" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Method</CardTitle>
                <CardDescription>Choose how you want to pay</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-4">
                <Button
                  variant={selectedPayment === 'usd' ? 'default' : 'outline'}
                  onClick={() => setSelectedPayment('usd')}
                  className="flex-1"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay with USD
                </Button>
                <Button
                  variant={selectedPayment === 'pawbucks' ? 'default' : 'outline'}
                  onClick={() => setSelectedPayment('pawbucks')}
                  className="flex-1"
                >
                  <Coins className="mr-2 h-4 w-4" />
                  Pay with PawBucks
                </Button>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {products?.map((product) => {
                const Icon = getIcon(product.name);
                const isSubscription = product.product_type === 'subscription';
                const isActive = isSubscription ? hasActiveSubscription(product.name) : hasPurchased(product.name);

                return (
                  <GradientCard key={product.id} gradient>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-primary/10">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{product.name}</h3>
                          {isSubscription && product.billing_period && (
                            <Badge variant="secondary" className="mt-1">
                              {product.billing_period}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {isActive && (
                        <Badge className="bg-green-500">
                          <Check className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>

                    <p className="text-muted-foreground mb-4">{product.description}</p>

                    <div className="space-y-2 mb-4">
                      {(product.features as string[]).map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 border-t border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold">
                          {selectedPayment === 'usd' 
                            ? `$${product.price_usd}${isSubscription ? '/mo' : ''}`
                            : `${product.price_pawbucks.toLocaleString()} PB${isSubscription ? '/mo' : ''}`
                          }
                        </span>
                      </div>
                      
                      <Button 
                        className="w-full"
                        onClick={() => handlePurchase(product.id, product.product_type)}
                        disabled={isActive}
                      >
                        {isActive ? 'Already Active' : isSubscription ? 'Subscribe Now' : 'Purchase Report'}
                      </Button>
                    </div>
                  </GradientCard>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="subscriptions">
            {subscriptions && subscriptions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {subscriptions.map((sub) => (
                  <Card key={sub.id}>
                    <CardHeader>
                      <CardTitle>{sub.merchant_analytics_products.name}</CardTitle>
                      <CardDescription>
                        Active until {new Date(sub.end_date!).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Payment Method</span>
                          <span className="font-medium">{sub.payment_method.toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Next Billing</span>
                          <span className="font-medium">
                            {new Date(sub.next_billing_date!).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No active subscriptions</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="reports">
            {purchases && purchases.length > 0 ? (
              <div className="space-y-4">
                {purchases.map((purchase) => (
                  <Card key={purchase.id}>
                    <CardHeader>
                      <CardTitle>{purchase.merchant_analytics_products.name}</CardTitle>
                      <CardDescription>
                        Purchased on {new Date(purchase.purchase_date).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Paid: </span>
                          <span className="font-medium">
                            {purchase.payment_method === 'usd' 
                              ? `$${purchase.amount_paid}` 
                              : `${purchase.amount_paid} PB`
                            }
                          </span>
                        </div>
                        {purchase.report_data && (
                          <Button size="sm">View Report</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No reports purchased yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}