import { useState, useRef, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const MERCHANT_TOS_CONTENT = `PAWBUCKS MERCHANT TERMS OF SERVICE

(Including Veterinary Professionals)

Effective Date: February 2, 2026
Last Updated: February 5, 2026

These Merchant Terms of Service ("Agreement") govern your access to and use of the PawBucks platform, website, applications, software, APIs, and related services (collectively, the "Platform") provided by PawBucks, Inc. ("PawBucks," "we," "us," or "our").

By registering for, accessing, or using the Platform as a merchant, service provider, seller, or veterinary professional, you agree to be legally bound by this Agreement.

⸻

1. DEFINITIONS

1.1 Merchant

"Merchant" means any individual or entity that offers goods or services through the Platform, including but not limited to:
• Pet care providers
• Dog walkers, trainers, and behaviorists
• Groomers
• Boarding providers
• Licensed veterinarians, veterinary clinics, veterinary hospitals, and veterinary professionals

Unless expressly stated otherwise, all references to "Merchant" apply equally to veterinary professionals.

⸻

2. PLATFORM ROLE AND RELATIONSHIP

2.1 Marketplace Technology Provider

PawBucks provides a technology marketplace that enables Merchants to connect with customers and process payments.

PawBucks does not provide veterinary services, medical advice, diagnosis, treatment, or professional pet care services of any kind.

2.2 No Agency or Medical Relationship

PawBucks is not:
• A veterinary practice
• A medical provider
• A healthcare intermediary
• An agent, partner, or employer of any Merchant

No veterinarian-client-patient relationship (VCPR) is created between PawBucks and any customer.

⸻

3. MERCHANT ELIGIBILITY AND PROFESSIONAL REQUIREMENTS

3.1 General Eligibility

You represent and warrant that:
• You are legally authorized to operate your business
• You have authority to enter this Agreement
• Your use of the Platform complies with all applicable laws

3.2 Veterinary Licensing and Compliance (Critical)

If you are a veterinary professional, you represent and warrant that:
• You hold all required licenses, registrations, and certifications
• You comply with state veterinary practice acts
• You comply with telemedicine and VCPR requirements
• You do not provide veterinary services where prohibited by law
• You maintain all required professional liability and malpractice insurance

PawBucks does not verify licensure and assumes no responsibility for licensing compliance.

⸻

4. PAYMENTS, STRIPE CONNECT, AND FUNDS FLOW

4.1 Payment Processing

PawBucks uses third-party payment processors, including Stripe, Inc. By using the Platform, you agree to be bound by Stripe's applicable agreements.

4.2 Merchant of Record

For all transactions:
• You are the merchant of record
• Customers purchase goods or services directly from you
• Payments are processed on your behalf via your connected Stripe account

4.3 Financial Responsibility

You acknowledge and agree that you are solely responsible for:
• Stripe processing fees
• Chargebacks, disputes, refunds, and reversals
• Penalties, fines, or negative balances

PawBucks bears no financial liability for your transactions.

⸻

5. PAWBUCKS NETWORK FEE

5.1 Network Fee

PawBucks charges a network service fee equal to 3% of the transaction amount ("Network Fee") for access to marketplace technology and related services.

5.2 Fee Collection

The Network Fee is collected as a Stripe application fee and deducted from transaction proceeds at the time of payment processing.

⸻

6. PASS-THROUGH OF NETWORK FEE TO CUSTOMERS

6.1 Permitted Pass-Through

Merchants may pass the Network Fee through to customers or incorporate it into pricing provided that:
• The fee is clearly disclosed before payment
• The fee is described as a platform, marketplace, or service fee
• The fee is not represented as a credit card or processing fee

6.2 Prohibited Characterization

The Network Fee must not be described as:
• A credit card fee
• A processing fee
• A Stripe fee
• A payment method surcharge

6.3 Veterinary Disclosure Requirement

Veterinary professionals must ensure that any platform or service fees are disclosed separately from medical services and do not violate professional ethics rules or state veterinary regulations.

⸻

7. MEDICAL AND PROFESSIONAL DISCLAIMERS (VETERINARY)

7.1 No Medical Oversight

PawBucks does not:
• Review medical decisions
• Supervise treatment
• Set standards of care
• Establish or manage VCPRs

7.2 Veterinary Responsibility

Veterinary professionals are solely responsible for:
• Medical decisions and outcomes
• Compliance with professional standards
• Client communications
• Recordkeeping and informed consent

7.3 No Emergency Services

PawBucks does not provide emergency veterinary services and is not responsible for emergency response or outcomes.

⸻

8. TAXES, PRICING, AND DISCLOSURES

Merchants are solely responsible for:
• Pricing
• Tax determination, collection, and remittance
• Compliance with consumer and professional disclosure laws

⸻

9. REFUNDS, DISPUTES, AND CHARGEBACKS

Merchants are solely responsible for:
• Refund policies
• Dispute resolution
• Chargeback defense
• Associated fees and penalties

⸻

10. PROHIBITED USES

You may not:
• Misrepresent professional credentials
• Provide unlawful veterinary services
• Circumvent Network fees
• Engage in deceptive or fraudulent conduct
• Violate Stripe policies or professional regulations

⸻

11. TERMINATION

PawBucks may suspend or terminate access immediately for:
• Legal or regulatory risk
• Professional misconduct
• Payment processor requirements
• Violation of this Agreement

⸻

12. DISCLAIMERS

THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE."
PAWBUCKS DISCLAIMS ALL WARRANTIES, INCLUDING WARRANTIES RELATED TO MEDICAL OR PROFESSIONAL SERVICES.

⸻

13. LIMITATION OF LIABILITY

PAWBUCKS SHALL NOT BE LIABLE FOR:
• MEDICAL MALPRACTICE
• PROFESSIONAL NEGLIGENCE
• TREATMENT OUTCOMES
• LICENSING VIOLATIONS

TOTAL LIABILITY SHALL NOT EXCEED PLATFORM FEES PAID IN THE PRIOR 12 MONTHS.

⸻

14. INDEMNIFICATION

You agree to indemnify PawBucks for any claims arising from:
• Veterinary services
• Medical advice or treatment
• Professional misconduct
• Regulatory violations

⸻

15. GOVERNING LAW

This Agreement is governed by the laws of the State of California.

⸻

16. CONTACT INFORMATION

PawBucks, Inc.
12609 Woodgreen St. Los Angeles, CA 90066
Legal@PawBucks.app`;

interface MerchantTermsOfServiceProps {
  agreed: boolean;
  onAgreeChange: (agreed: boolean) => void;
  disabled?: boolean;
}

export const MerchantTermsOfService = ({
  agreed,
  onAgreeChange,
  disabled = false,
}: MerchantTermsOfServiceProps) => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 20;
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  }, [hasScrolledToBottom]);

  const canCheck = hasScrolledToBottom;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Merchant Terms of Service
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-64 overflow-y-auto border rounded-lg p-4 bg-muted/30 text-sm whitespace-pre-wrap font-mono"
        >
          {MERCHANT_TOS_CONTENT}
        </div>

        {!hasScrolledToBottom && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Please scroll to the bottom to read the entire agreement</span>
          </div>
        )}

        <div className="flex items-start space-x-3">
          <Checkbox
            id="tos-agreement"
            checked={agreed}
            onCheckedChange={(checked) => onAgreeChange(checked === true)}
            disabled={disabled || !canCheck}
            className={cn(!canCheck && "opacity-50 cursor-not-allowed")}
          />
          <Label
            htmlFor="tos-agreement"
            className={cn(
              "text-sm cursor-pointer leading-relaxed",
              !canCheck && "opacity-50 cursor-not-allowed"
            )}
          >
            I have read and agree to the PawBucks Merchant Terms of Service
          </Label>
        </div>
      </CardContent>
    </Card>
  );
};
