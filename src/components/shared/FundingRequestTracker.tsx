import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Search, XCircle, FileText, ArrowRight, DollarSign, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";

type FundingRequest = {
  id: string;
  requested_amount: number;
  status: string;
  reason?: string | null;
  purpose?: string | null;
  created_at: string;
  updated_at: string;
};

interface FundingRequestTrackerProps {
  requests: FundingRequest[];
  loading?: boolean;
  entityType: "merchant" | "vet";
}

const STEPS = [
  { key: "pending", label: "Submitted", icon: FileText, description: "Your request has been received" },
  { key: "in_review", label: "In Review", icon: Search, description: "Our team is evaluating your request" },
  { key: "decision", label: "Decision", icon: CheckCircle2, description: "A decision has been made" },
  { key: "funded", label: "Funded", icon: DollarSign, description: "Funds have been disbursed" },
] as const;

function getStepIndex(status: string): number {
  if (status === "pending") return 0;
  if (status === "in_review") return 1;
  if (status === "approved" || status === "denied") return 2;
  if (status === "funded") return 3;
  return 0;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> Submitted</Badge>;
    case "in_review":
      return <Badge className="gap-1 bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/20"><Search className="w-3 h-3" /> In Review</Badge>;
    case "approved":
      return <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20"><CheckCircle2 className="w-3 h-3" /> Approved</Badge>;
    case "funded":
      return <Badge className="gap-1 bg-blue-500/15 text-blue-600 border-blue-500/30 hover:bg-blue-500/20"><DollarSign className="w-3 h-3" /> Funded</Badge>;
    case "denied":
      return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Denied</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function StepIndicator({ step, currentIndex, isLast, status }: {
  step: typeof STEPS[number];
  currentIndex: number;
  isLast: boolean;
  status: string;
}) {
  const stepIdx = STEPS.findIndex(s => s.key === step.key);
  const isCompleted = stepIdx < currentIndex;
  const isCurrent = stepIdx === currentIndex;
  const isDenied = status === "denied" && step.key === "decision";
  const isApproved = (status === "approved" || status === "funded") && step.key === "decision";
  const isFunded = status === "funded" && step.key === "funded";

  const Icon = isDenied ? XCircle : (isApproved || isFunded) ? CheckCircle2 : step.icon;

  return (
    <div className="flex items-center flex-1 min-w-0">
      <div className="flex flex-col items-center gap-1.5">
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
            isCompleted && "bg-primary border-primary text-primary-foreground",
            isCurrent && !isDenied && !isFunded && "border-primary bg-primary/10 text-primary ring-4 ring-primary/20",
            isCurrent && isDenied && "border-destructive bg-destructive/10 text-destructive ring-4 ring-destructive/20",
            isCurrent && (isApproved || isFunded) && "border-emerald-500 bg-emerald-500/10 text-emerald-600 ring-4 ring-emerald-500/20",
            !isCompleted && !isCurrent && "border-muted-foreground/30 text-muted-foreground/50"
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <span className={cn(
          "text-xs font-medium text-center whitespace-nowrap",
          (isCompleted || isCurrent) ? "text-foreground" : "text-muted-foreground"
        )}>
          {isDenied ? "Denied" : isFunded ? "Funded" : isApproved ? "Approved" : step.label}
        </span>
      </div>
      {!isLast && (
        <div className={cn(
          "flex-1 h-0.5 mx-2 mt-[-1.25rem] rounded-full transition-all",
          isCompleted ? "bg-primary" : "bg-muted-foreground/20"
        )} />
      )}
    </div>
  );
}

function useApprovalConfetti(status: string) {
  const hasFired = useRef(false);

  useEffect(() => {
    if (status === "approved" && !hasFired.current) {
      hasFired.current = true;
      // Fire confetti from the left and right
      const fireConfetti = () => {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { x: 0.2, y: 0.6 },
          colors: ['#10b981', '#34d399', '#6ee7b7', '#059669', '#047857'],
        });
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { x: 0.8, y: 0.6 },
          colors: ['#10b981', '#34d399', '#6ee7b7', '#059669', '#047857'],
        });
      };
      fireConfetti();
      // Second burst after a short delay for extra celebration
      setTimeout(fireConfetti, 300);
    }
  }, [status]);
}

function RequestCard({ request, entityType }: { request: FundingRequest; entityType: string }) {
  const currentIndex = getStepIndex(request.status);
  const reason = request.reason || request.purpose || "—";

  useApprovalConfetti(request.status);

  return (
    <Card className="hover:shadow-[var(--shadow-medium)] transition-all">
      <CardContent className="pt-6 space-y-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="font-bold text-lg">${request.requested_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              {getStatusBadge(request.status)}
            </div>
            <p className="text-sm text-muted-foreground truncate">{reason}</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
            <CalendarDays className="w-3.5 h-3.5" />
            {format(new Date(request.created_at), "MMM d, yyyy")}
          </div>
        </div>

        {/* Pipeline tracker */}
        <div className="flex items-start px-2">
          {STEPS.map((step, idx) => (
            <StepIndicator
              key={step.key}
              step={step}
              currentIndex={currentIndex}
              isLast={idx === STEPS.length - 1}
              status={request.status}
            />
          ))}
        </div>

        {/* Status description */}
        <div className={cn(
          "rounded-lg px-4 py-3",
          request.status === "approved" ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-muted/50"
        )}>
          <p className={cn(
            "text-sm",
            request.status === "approved" ? "text-emerald-700 font-medium" : "text-muted-foreground"
          )}>
            {request.status === "pending" && "Your request has been submitted and is waiting to be reviewed by our team."}
            {request.status === "in_review" && "Our underwriting team is currently evaluating your request. We'll notify you once a decision is made."}
            {request.status === "approved" && "🎉 Congratulations! Your funding request has been approved. Funds will be disbursed shortly."}
            {request.status === "denied" && "Unfortunately, your funding request was not approved at this time. You may reapply in the future."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function FundingRequestTracker({ requests, loading, entityType }: FundingRequestTrackerProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-48 mx-auto" />
            <div className="h-3 bg-muted rounded w-32 mx-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!requests.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-2">
          <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <p className="text-muted-foreground font-medium">No Funding Requests</p>
          <p className="text-sm text-muted-foreground">
            {entityType === "merchant"
              ? "When you submit a funding request, you'll be able to track its progress here."
              : "When you submit a loan request, you'll be able to track its progress here."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Funding Request Tracker</h3>
          <p className="text-sm text-muted-foreground">Track every step of your {requests.length > 1 ? `${requests.length} requests` : "request"}</p>
        </div>
      </div>
      {requests.map((req) => (
        <RequestCard key={req.id} request={req} entityType={entityType} />
      ))}
    </div>
  );
}