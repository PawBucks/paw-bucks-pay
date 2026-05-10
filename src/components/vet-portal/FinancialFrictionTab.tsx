import { useState, useEffect } from"react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { WellnessPlanArchitect } from"./WellnessPlanArchitect";
import { InsuranceClaimSplitter } from"./InsuranceClaimSplitter";
import { FundingRequestTracker } from"@/components/shared/FundingRequestTracker";

import { supabase } from"@/integrations/supabase/client";

interface FinancialFrictionTabProps {
 vetId: string;
}

export function FinancialFrictionTab({ vetId }: FinancialFrictionTabProps) {
 const [loanRequests, setLoanRequests] = useState<any[]>([]);
 const [loadingLoans, setLoadingLoans] = useState(true);

 useEffect(() => {
 async function loadLoans() {
 setLoadingLoans(true);
 const { data } = await supabase
 .from("vet_loans")
 .select("*")
 .eq("vet_id", vetId)
 .order("created_at", { ascending: false });

 // Map vet_loans fields to the tracker's expected shape
 const mapped = (data || []).map((loan: any) => ({
 id: loan.id,
 requested_amount: loan.requested_amount,
 status: loan.status,
 reason: loan.purpose,
 created_at: loan.created_at,
 updated_at: loan.updated_at,
 }));
 setLoanRequests(mapped);
 setLoadingLoans(false);
 }
 loadLoans();
 }, [vetId]);

 return (
 <div className="space-y-6">
 {/* Funding/Loan Request Tracker */}
 <FundingRequestTracker
 requests={loanRequests}
 loading={loadingLoans}
 entityType="vet"
 />

 <Tabs defaultValue="wellness" className="space-y-4">
 <TabsList className="grid w-full grid-cols-2 max-w-md">
 <TabsTrigger value="wellness" className="flex items-center gap-2">
 <span className="h-4 w-4" aria-hidden="true">❤️</span>
 Wellness Plans
 </TabsTrigger>
 <TabsTrigger value="insurance" className="flex items-center gap-2">
 <span className="h-4 w-4" aria-hidden="true">🛡️</span>
 Insurance Claims
 </TabsTrigger>
 </TabsList>

 <TabsContent value="wellness">
 <WellnessPlanArchitect vetId={vetId} />
 </TabsContent>

 <TabsContent value="insurance">
 <InsuranceClaimSplitter vetId={vetId} />
 </TabsContent>
 </Tabs>
 </div>
 );
}
