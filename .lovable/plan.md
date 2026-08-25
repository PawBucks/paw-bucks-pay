# Resolve verified inbound pet email not appearing in the inbox

## Direct answer
Do not create duplicate DNS records. If `inbox.pawbucks.app` is already verified, DNS setup is no longer the problem.

The next likely failure point is the handoff after the email provider accepts the message: inbound routing, webhook delivery, signature configuration, or app-side processing/storage.

## What I will verify next
1. **Inbound route is enabled**
   - Confirm that `inbox.pawbucks.app` has an active receiving route for addresses like `fiona@inbox.pawbucks.app`.
   - Confirm the route forwards received messages to the app’s receiving endpoint, not just verifies the domain.

2. **Webhook destination is correct**
   - Confirm the provider is sending inbound email events to the active app backend endpoint for pet email intake.
   - Check whether the webhook has recent delivery attempts, failures, retries, or disabled status.

3. **Webhook signing matches the app**
   - The receiving backend requires signed inbound events.
   - I will confirm whether the configured signing secret matches the provider’s current webhook secret.
   - If the provider webhook was recreated after the app secret was set, verified DNS would still pass but deliveries could be rejected.

4. **Fresh end-to-end test**
   - Send a new email to `fiona@inbox.pawbucks.app` after confirming the route/webhook.
   - Check whether the receiving backend logs the event.
   - Check whether the email record appears in the pet inbox data.

5. **App-side processing check**
   - If the backend receives the event but it does not appear in the UI, verify recipient matching, active pet email status, message storage, attachment handling, and inbox display logic.

## What I will not do
- I will not ask you to add duplicate DNS records.
- I will not change outbound/auth email setup unless the investigation proves it is directly involved.
- I will not make broad platform changes unrelated to inbound pet email.

## Expected outcome
After this, we should know exactly which stage is failing:

```text
Sender email
  -> verified inbound domain
  -> active inbound route
  -> webhook delivery
  -> receiving backend
  -> pet email record
  -> pet inbox UI
```

Then I will apply the smallest fix needed at that exact stage.
