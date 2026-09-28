# Fix in-app notifications blocked by database rules

## Problem (confirmed)
Only admins may add notifications. About 10 website screens (receipt upload, service purchase, consultation scheduling, merchant scheduling, grooming report cards, vet tools) add notifications using the signed-in person's account, so those notifications are silently rejected and never reach the bell or push alerts.

Letting anyone insert any notification is unsafe (people could spam or spoof alerts to other users), so the fix goes through one checked server path.

## What changes
1. Add a secure server function, `create_app_notification(target_user_id, title, message, type, link_url)`, that only allows a notification when:
   - the target is the caller themselves, or
   - the caller and target share a real relationship: a booking, service purchase, consultation, receipt or report card between that customer and a business the caller owns (or the reverse), or a vet linked to the pet owner.
   It limits title/message length and fills in the timestamp. Admins keep their current direct access.
2. Update each website screen that adds notifications directly to call this function instead, and log an error if it is refused.
3. Leave the notifications table, its existing rules and the push relay unchanged, so push alerts keep firing automatically.

## Verify
- Signed in as a pet owner: upload a receipt, and check a notification row appears for yourself and the business.
- Confirm a call targeting an unrelated user is refused.

## Technical details
- Security-definer SQL function with `search_path = public`, EXECUTE granted to `authenticated` only.
- Admin-only inserts in AdminDashboard/ReceiptsTab/NonPartnerReceiptVerificationTab stay as they are.
