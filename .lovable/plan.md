## Clover Webhook Endpoint

Use this URL in the Clover App Marketplace settings under **Webhooks → Webhook URL**:

```
https://yxpnkipcoxksmnsvpvwi.supabase.co/functions/v1/clover-pos-webhook
```

### Configuration details

- **Method:** `POST`
- **Content-Type:** `application/json`
- **Authentication header (per merchant):** `x-api-key: <merchant POS API key>` — generated in Merchant Workspace → POS & API Integration
- **Verification challenge:** Clover sends a GET with a `?verification_code=` query param when you save the webhook. The endpoint already responds with the code as plain text to complete verification.
- **Events to subscribe to:** `PAYMENTS` (created/updated), `ORDERS` (created/updated), `REFUNDS`. These map directly into `pos_transactions` and trigger PawBucks earn/redeem plus the 3% Success Fee accounting automatically.

### No code changes required

The `clover-pos-webhook` edge function is already deployed and live at the URL above. No plan steps to implement — this plan exists only to hand you the exact URL and configuration for the Clover Marketplace listing.

If you'd like, approve this plan and I can additionally:
- Surface this URL inside the Merchant Workspace POS Integration page so merchants can copy it directly, or
- Add a Clover-specific setup guide (screenshots + event list) to the POS Integration portal.

Let me know which (if either) to include and I'll extend the plan.
