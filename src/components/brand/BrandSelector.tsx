import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAllActiveBrands, useMerchantEnrolledBrands } from "@/hooks/useBrands";

const NONE = "__none__";

interface BrandSelectorProps {
  value: string | null | undefined;
  onChange: (brandId: string | null) => void;
  /** Restrict options to brands the merchant is enrolled in. Omit for admin. */
  merchantId?: string | null;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Brand tag selector for catalog items, services, invoice lines, etc.
 * Brand-tagged items are what unlock branded PawBucks redemptions for a
 * customer at checkout.
 */
export function BrandSelector({
  value,
  onChange,
  merchantId,
  disabled,
  placeholder = "No brand",
}: BrandSelectorProps) {
  const allBrands = useAllActiveBrands();
  const merchantBrands = useMerchantEnrolledBrands(merchantId);
  const useMerchantScope = merchantId !== undefined;
  const { data: brands = [], isLoading } = useMerchantScope ? merchantBrands : allBrands;

  const current = value ?? NONE;

  return (
    <Select
      value={current}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No brand</SelectItem>
        {brands.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.brand_name}
          </SelectItem>
        ))}
        {useMerchantScope && brands.length === 0 && !isLoading && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            Not enrolled in any brand campaigns yet.
          </div>
        )}
      </SelectContent>
    </Select>
  );
}