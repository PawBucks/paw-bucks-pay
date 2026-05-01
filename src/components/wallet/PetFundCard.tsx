import { useState } from"react";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Progress } from"@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from"@/components/ui/collapsible";
import { Gift, Calendar, Clock, CheckCircle, Lock, ChevronDown, ChevronUp, Users, Sparkles, TrendingUp } from"lucide-react";
import { usePetFund, type PetFundRelease } from"@/hooks/usePetFund";
import { format, formatDistanceToNow } from"date-fns";
import { useNavigate } from"react-router-dom";
import { Loader2 } from"lucide-react";

import { Formatters } from "@/utils/formatters";
interface PetFundCardProps {
 userId: string;
}

export const PetFundCard = ({ userId }: PetFundCardProps) => {
 const navigate = useNavigate();
 const {
 fund,
 loading,
 hasPetFund,
 availableBalance,
 availableBalanceUsd,
 escrowBalance,
 escrowBalanceUsd,
 totalAmount,
 totalAmountUsd,
 totalUsed,
 totalUsedUsd,
 totalRemainingUsd,
 nextRelease,
 releases,
 referrerBonuses,
 } = usePetFund(userId);

 const [showTimeline, setShowTimeline] = useState(false);

 if (loading) {
 return (
 <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
 <CardContent className="flex items-center justify-center py-8">
 <Loader2 className="w-6 h-6 animate-spin text-primary" />
 </CardContent>
 </Card>
 );
 }

 if (!hasPetFund) return null;

 const usedPercentage = totalAmount > 0 ? (totalUsed / totalAmount) * 100 : 0;
 const releasedPercentage = fund?.ledger ? (fund.ledger.totalReleased / totalAmount) * 100 : 0;

 const getStatusIcon = (status: string) => {
 switch (status) {
 case'released': return <CheckCircle className="w-3.5 h-3.5 text-success" />;
 case'used': return <CheckCircle className="w-3.5 h-3.5 text-muted-foreground" />;
 case'pending': return <Lock className="w-3.5 h-3.5 text-warning" />;
 default: return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
 }
 };

 const getStatusBadge = (release: PetFundRelease) => {
 if (release.usedAt) {
 return <Badge variant="outline" className="text-xs bg-muted">Used</Badge>;
 }
 if (release.status ==='released') {
 return <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">Available</Badge>;
 }
 return <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">Locked</Badge>;
 };

 return (
 <div className="space-y-4">
 {/* Main Fund Card */}
 <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 overflow-hidden">
 <CardHeader className="pb-3">
 <CardTitle className="flex items-center justify-between">
 <span className="flex items-center gap-2 text-lg">
 <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
 <Gift className="w-4 h-4 text-primary-foreground" />
 </div>
 Welcome Credit Fund
 </span>
 <Badge variant="outline" className="bg-success/10 text-success border-success/30">
 Active
 </Badge>
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 {/* Total Remaining */}
 <div className="text-center py-2">
 <p className="text-sm text-muted-foreground mb-1">Total Remaining Fund</p>
 <p className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
 {(totalAmount - totalUsed).toLocaleString()} PB
 </p>
 <p className="text-lg text-muted-foreground">{Formatters.currency(totalRemainingUsd)}</p>
 </div>

 {/* Progress Bar */}
 <div className="space-y-2">
 <div className="flex justify-between text-xs text-muted-foreground">
 <span>Used: {Formatters.currency(totalUsedUsd)}</span>
 <span>Total: {Formatters.currency(totalAmountUsd)}</span>
 </div>
 <Progress value={usedPercentage} className="h-2" />
 </div>

 {/* Balance Cards */}
 <div className="grid grid-cols-2 gap-3">
 <div className="rounded-lg border border-success/20 bg-success/5 p-3">
 <div className="flex items-center gap-1.5 mb-1">
 <CheckCircle className="w-3.5 h-3.5 text-success" />
 <span className="text-xs text-muted-foreground">Available Now</span>
 </div>
 <p className="text-xl font-bold text-success">{Formatters.currency(availableBalanceUsd)}</p>
 <p className="text-xs text-success/60">{availableBalance.toLocaleString()} PB</p>
 </div>
 <div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
 <div className="flex items-center gap-1.5 mb-1">
 <Lock className="w-3.5 h-3.5 text-warning" />
 <span className="text-xs text-muted-foreground">In Escrow</span>
 </div>
 <p className="text-xl font-bold text-warning">{Formatters.currency(escrowBalanceUsd)}</p>
 <p className="text-xs text-warning/60">{escrowBalance.toLocaleString()} PB</p>
 </div>
 </div>

 {/* Next Release */}
 {nextRelease && (
 <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
 <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
 <Calendar className="w-5 h-5 text-primary" />
 </div>
 <div className="flex-1">
 <p className="text-sm font-medium">Next Release: ${(nextRelease.amount / 1000).toFixed(0)}</p>
 <p className="text-xs text-muted-foreground">
 {formatDistanceToNow(new Date(nextRelease.scheduledAt), { addSuffix: true })}
 {' ·'}
 {format(new Date(nextRelease.scheduledAt),'MMM d, yyyy')}
 </p>
 </div>
 <Badge variant="outline" className="text-xs">
 Month {nextRelease.monthNumber}
 </Badge>
 </div>
 )}

 {/* Release Timeline (Collapsible) */}
 <Collapsible open={showTimeline} onOpenChange={setShowTimeline}>
 <CollapsibleTrigger asChild>
 <Button variant="ghost" className="w-full flex items-center justify-between text-sm">
 <span className="flex items-center gap-2">
 <TrendingUp className="w-4 h-4" />
 Release Schedule ({releases.filter(r => r.usedAt).length}/{releases.length} used)
 </span>
 {showTimeline ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
 </Button>
 </CollapsibleTrigger>
 <CollapsibleContent className="space-y-1.5 mt-2">
 {releases.map((release) => (
 <div
 key={release.id}
 className={`flex items-center justify-between p-2.5 rounded-lg border text-sm ${
 release.usedAt
 ?'bg-muted/30 border-border/30 opacity-60'
 : release.status ==='released'
 ?'bg-success/5 border-success/20'
 :'bg-muted/20 border-border/50'
 }`}
 >
 <div className="flex items-center gap-2">
 {getStatusIcon(release.usedAt ?'used' : release.status)}
 <div>
 <span className="font-medium">
 {release.monthNumber === 0 ?'Signup Bonus' : `Month ${release.monthNumber}`}
 </span>
 <span className="text-xs text-muted-foreground ml-2">
 (min ${release.minTransactionUsd})
 </span>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <span className={`font-medium ${release.usedAt ?'line-through text-muted-foreground' :''}`}>
 ${(release.amount / 1000).toFixed(0)}
 </span>
 {getStatusBadge(release)}
 </div>
 </div>
 ))}
 </CollapsibleContent>
 </Collapsible>
 </CardContent>
 </Card>

 {/* Refer & Earn Card */}
 <Card className="border-accent/20 bg-gradient-to-r from-accent/5 to-primary/5 cursor-pointer hover:shadow-md transition-shadow"
 onClick={() => navigate('/referrals')}>
 <CardContent className="flex items-center gap-4 py-4">
 <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center flex-shrink-0">
 <Users className="w-6 h-6 text-primary-foreground" />
 </div>
 <div className="flex-1">
 <p className="font-semibold flex items-center gap-1">
 Refer & Earn
 <Sparkles className="w-4 h-4 text-accent" />
 </p>
 <p className="text-sm text-muted-foreground">
 Gift a friend up to $250 in credits and get $10 when they join!
 </p>
 </div>
 <ChevronDown className="w-5 h-5 text-muted-foreground -rotate-90" />
 </CardContent>
 </Card>

 {/* Referrer Bonuses */}
 {referrerBonuses.length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm flex items-center gap-2">
 <Gift className="w-4 h-4 text-accent" />
 Referral Bonuses
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-2">
 {referrerBonuses.map((bonus, i) => (
 <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
 <div>
 <p className="text-sm font-medium">
 {bonus.status ==='released' ?'✅ Released' : bonus.status ==='locked' ?'🔒 Locked' :'⏳ Pending'}
 </p>
 <p className="text-xs text-muted-foreground">
 {bonus.status ==='pending' &&'Waiting for friend\'s first $40+ purchase'}
 {bonus.status ==='locked' && bonus.releaseAt && `Unlocks ${formatDistanceToNow(new Date(bonus.releaseAt), { addSuffix: true })}`}
 {bonus.status ==='released' &&'Added to your PawBucks wallet!'}
 </p>
 </div>
 <span className="font-bold text-accent">${(bonus.amount / 1000).toFixed(0)}</span>
 </div>
 ))}
 </CardContent>
 </Card>
 )}
 </div>
 );
};
