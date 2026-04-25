import { useState, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

export const VET_ADDENDUM_CONTENT = `PAWBUCKS

VETERINARY SERVICES DISCLOSURE ADDENDUM

Effective Date: February 5, 2026

This Veterinary Services Disclosure Addendum ("Addendum") supplements and forms part of the PawBucks Merchant Terms of Service (the "Merchant Agreement") between PawBucks, Inc. ("PawBucks") and any Merchant that is a licensed veterinary professional, veterinary clinic, veterinary hospital, or veterinary service provider ("Veterinary Merchant").

In the event of a conflict, this Addendum controls with respect to veterinary-specific matters.

⸻

1. PURPOSE OF THIS ADDENDUM

This Addendum exists to:
• Clarify PawBucks' non-medical role
• Allocate all veterinary responsibility to the Veterinary Merchant
• Address licensing, VCPR, malpractice, and regulatory risk
• Ensure transparent disclosure to pet owners
• Protect PawBucks from medical, ethical, and professional liability

⸻

2. NO VETERINARY OR MEDICAL SERVICES PROVIDED BY PAWBUCKS

2.1 Platform-Only Role

PawBucks is a technology and payments platform only.

PawBucks does not:
• Practice veterinary medicine
• Provide medical advice, diagnosis, or treatment
• Supervise or evaluate veterinary services
• Establish or manage veterinarian-client-patient relationships (VCPR)

2.2 No Veterinary Oversight

PawBucks does not:
• Set standards of veterinary care
• Review treatment plans
• Approve prescriptions
• Monitor medical outcomes

All veterinary judgment rests solely with the Veterinary Merchant.

⸻

3. VETERINARIAN-CLIENT-PATIENT RELATIONSHIP (VCPR)

3.1 VCPR Responsibility

The Veterinary Merchant is solely responsible for establishing, maintaining, and documenting a valid VCPR in compliance with all applicable laws.

3.2 No Implied VCPR

Use of the PawBucks Platform does not create a VCPR between:
• PawBucks and any customer, or
• PawBucks and any animal.

⸻

4. LICENSING, CREDENTIALS, AND COMPLIANCE

4.1 Licensing Representation

The Veterinary Merchant represents and warrants that they:
• Hold all required veterinary licenses
• Are in good standing with applicable regulatory boards
• Comply with all state and federal veterinary laws

4.2 No Verification by PawBucks

PawBucks does not verify:
• Veterinary licenses
• Board certifications
• Scope-of-practice compliance

Any misrepresentation of credentials is the sole responsibility of the Veterinary Merchant.

⸻

5. TELEMEDICINE AND REMOTE SERVICES (IF APPLICABLE)

5.1 Legal Compliance

If offering telemedicine, virtual consults, or remote services, the Veterinary Merchant represents that such services:
• Are permitted under applicable state law
• Comply with VCPR and telehealth requirements
• Do not exceed the lawful scope of practice

5.2 Jurisdictional Restrictions

The Veterinary Merchant is responsible for ensuring services are not provided to customers in jurisdictions where such services are prohibited.

⸻

6. EMERGENCY AND URGENT CARE DISCLAIMER

6.1 No Emergency Services by PawBucks

PawBucks does not provide emergency veterinary services and is not an emergency response provider.

6.2 Veterinary Merchant Duty

Veterinary Merchants must:
• Clearly disclose whether they offer emergency services
• Direct clients to appropriate emergency facilities when necessary
• Avoid implying PawBucks provides or coordinates emergency care

⸻

7. FEES, SUCCESS FEES, AND DISCLOSURES

7.1 Success Fee Disclosure

Veterinary Merchants acknowledge that PawBucks charges a network service fee for marketplace access and payment facilitation.

7.2 Passing Through Success Fees

Veterinary Merchants may pass through PawBucks success fees to clients only if:
• The fee is clearly disclosed prior to payment
• The fee is described as a platform, marketplace, or service fee
• The fee is not represented as a medical charge or card processing fee

7.3 Medical Fee Separation

Platform or service fees must be disclosed separately from:
• Medical services
• Diagnostic fees
• Treatment charges
• Prescriptions

⸻

8. PROFESSIONAL LIABILITY AND INSURANCE

8.1 Insurance Requirement

Veterinary Merchants are solely responsible for maintaining:
• Professional liability (malpractice) insurance
• Any other insurance required by law

8.2 No Coverage by PawBucks

PawBucks does not provide:
• Malpractice coverage
• Professional liability insurance
• Errors and omissions coverage for veterinary services

⸻

9. CLIENT COMMUNICATIONS AND CONSENT

9.1 Informed Consent

Veterinary Merchants are solely responsible for:
• Obtaining informed consent
• Maintaining medical records
• Complying with disclosure obligations

9.2 No Client Reliance on PawBucks

Veterinary Merchants must not represent that PawBucks:
• Endorses medical decisions
• Guarantees outcomes
• Reviews or approves care

⸻

10. LIMITATION OF PAWBUCKS LIABILITY

PawBucks shall have no liability for:
• Veterinary malpractice
• Medical negligence
• Treatment outcomes
• Licensing violations
• Ethical or professional discipline

⸻

11. INDEMNIFICATION

The Veterinary Merchant agrees to defend, indemnify, and hold harmless PawBucks from any claims arising out of:
• Veterinary services
• Medical advice or treatment
• Failure to establish a valid VCPR
• Licensing or regulatory violations

⸻

12. ACKNOWLEDGEMENT

By using the PawBucks Platform, the Veterinary Merchant acknowledges and agrees that:
• PawBucks is not a veterinary provider
• All veterinary responsibility rests solely with the Veterinary Merchant
• This Addendum is legally binding and enforceable`;

interface VetServicesAddendumProps {
  agreed: boolean;
  onAgreeChange: (agreed: boolean) => void;
  disabled?: boolean;
}

export const VetServicesAddendum = ({
  agreed,
  onAgreeChange,
  disabled = false,
}: VetServicesAddendumProps) => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

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
          <Stethoscope className="w-5 h-5 text-primary" />
          Veterinary Services Disclosure Addendum
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div 
          onScroll={handleScroll}
          className="h-64 overflow-y-auto border rounded-lg p-4 bg-muted/30 text-sm whitespace-pre-wrap font-mono"
        >
          {VET_ADDENDUM_CONTENT}
        </div>

        {!hasScrolledToBottom && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Please scroll to the bottom to read the entire addendum</span>
          </div>
        )}

        <div className="flex items-start space-x-3">
          <Checkbox
            id="addendum-agreement"
            checked={agreed}
            onCheckedChange={(checked) => onAgreeChange(checked === true)}
            disabled={disabled || !canCheck}
            className={cn(!canCheck && "opacity-50 cursor-not-allowed")}
          />
          <Label
            htmlFor="addendum-agreement"
            className={cn(
              "text-sm cursor-pointer leading-relaxed",
              !canCheck && "opacity-50 cursor-not-allowed"
            )}
          >
            I have read and agree to the Veterinary Services Disclosure Addendum
          </Label>
        </div>
      </CardContent>
    </Card>
  );
};
