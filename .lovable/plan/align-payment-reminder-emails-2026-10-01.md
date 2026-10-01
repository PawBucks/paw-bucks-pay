# Align Payment Reminder Emails

## Goal
Make the payment reminder and payment overdue emails visually consistent with PawBucks’ other branded invoice emails while preserving their current timing, wording, amounts, links, merchant identity, and overdue escalation rules.

## Changes
- Rework the shared reminder email layout to match the branded invoice email structure: teal merchant header, centered invoice identity, consistent status badge, detail and amount panels, payment button, contact area, and PawBucks footer.
- Keep overdue urgency visible through the status badge and supporting notice rather than switching the entire email to an unrelated orange/red design.
- Continue honoring each merchant’s saved logo and accent color where available.
- Keep the reminder and overdue variants in one shared template so they cannot drift apart.

## Verification
- Check both reminder and overdue variants for escaped customer/merchant data, correct amount and due-date display, valid payment links, and mobile-safe email markup.
- Deploy the updated email function and confirm the project remains healthy.

## Technical details
Only `send-invoice-reminders` changes. Scheduling, invoice status updates, duplicate-send prevention, recipients, and email delivery behavior remain unchanged.
