import { Sparkles } from "@/components/ui/sparkles-emoji";

interface BrandedCheckinPreviewProps {
 brandName: string;
 logoUrl?: string | null;
 color: string;
 headline: string;
 subtext: string;
 cta: string;
 pawbucksAmount: number;
}

/**
 * Approximates how the branded check-in screen will look to a pet owner.
 * Uses inline styles for the brand color since it is dynamic per-campaign.
 */
export function BrandedCheckinPreview({
 brandName,
 logoUrl,
 color,
 headline,
 subtext,
 cta,
 pawbucksAmount,
}: BrandedCheckinPreviewProps) {
 return (
 <div className="rounded-md border-2 border-border overflow-hidden shadow-lg bg-card max-w-sm mx-auto">
 {/* Branded header */}
 <div
 className="px-5 pt-5 pb-12 text-white relative"
 style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
 >
 <div className="flex items-center gap-2">
 {logoUrl ? (
 <img src={logoUrl} alt={brandName} className="w-8 h-8 rounded-lg object-cover bg-white/20 p-1" />
 ) : (
 <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold">
 {brandName.charAt(0).toUpperCase()}
 </div>
 )}
 <span className="text-sm font-semibold opacity-90">{brandName}</span>
 </div>
 </div>

 {/* Floating PawBucks badge */}
 <div className="px-5 -mt-8 relative">
 <div
 className="rounded-md shadow-xl px-4 py-3 flex items-center justify-between bg-card border"
 >
 <div>
 <p className="text-xs text-muted-foreground">Check-in reward</p>
 <p className="font-bold text-2xl tabular-nums" style={{ color }}>
 +{pawbucksAmount.toLocaleString()} PB
 </p>
 </div>
 <Sparkles className="h-7 w-7" style={{ color }} />
 </div>
 </div>

 {/* Body */}
 <div className="px-5 pt-4 pb-5 space-y-3">
 <h3 className="font-bold text-lg leading-tight">{headline}</h3>
 <p className="text-sm text-muted-foreground leading-snug">{subtext}</p>
 <button
 className="w-full py-3 rounded-md font-semibold text-white shadow-md hover:opacity-90 transition-opacity"
 style={{ background: color }}
 type="button"
 tabIndex={-1}
 >
 {cta}
 </button>
 </div>
 </div>
 );
}
