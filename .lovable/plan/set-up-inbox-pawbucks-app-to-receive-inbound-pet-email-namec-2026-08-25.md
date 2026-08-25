# Set up `inbox.pawbucks.app` to receive inbound pet email — Namecheap DNS

## Where you are right now
- DNS provider: **Namecheap** (Advanced DNS tab).
- You already have one correct record on the `inbox` host:
  - `MX  inbox  →  inbound-smtp.us-east-1.amazonaws.com`  priority 10  ✅ KEEP THIS — do not delete or change it.
- Three records still need to be added. Nothing you do here touches the root `pawbucks.app` domain or your outbound/auth email, so existing sending is unaffected.

## The full set of records for `inbox.pawbucks.app`
| # | Type | Host (Namecheap "Host" field) | Value | Priority | Status |
|---|------|------|-------|----------|--------|
| 1 | MX | `inbox` | `inbound-smtp.us-east-1.amazonaws.com` | 10 | ✅ Already exists — leave it |
| 2 | TXT | `resend._domainkey.inbox` | DKIM public key (see step 2) | — | Add |
| 3 | MX | `send.inbox` | `feedback-smtp.us-east-1.amazonses.com` | 10 | Add |
| 4 | TXT | `send.inbox` | `v=spf1 include:amazonses.com ~all` | — | Add |

## Important Namecheap rules (read first)
- Use **Advanced DNS** (not "Basic DNS" templates). Advanced DNS uses **relative hosts** — you enter only the subdomain part, not `pawbucks.app`.
- For nested subdomains like `send.inbox` and `resend._domainkey.inbox`, type the **full string exactly as shown** into the "Host" field (e.g. `send.inbox`). Namecheap appends `.pawbucks.app` automatically.
- For **MX records**, the mail server hostname value must **end with a trailing dot** is NOT required in Namecheap (it normalizes it). Enter `feedback-smtp.us-east-1.amazonses.com` as-is and set the Priority/MX Pref field to `10`.
- For **TXT records**, paste the value with **no surrounding quotes**. Namecheap adds nothing extra.
- **TTL**: leave at default (or the lowest available, e.g. 30 min) so propagation is faster.
- **Do NOT delete or edit the existing `inbox` MX record.** Only add the three new ones.

## Step-by-step in Namecheap

### Step 0 — Get the exact DKIM value from Resend
The DKIM public key is the one value that must match byte-for-byte, so copy it from Resend rather than typing it:
1. Open the Resend dashboard → **Inbound Emails** (or "Domains" → Inbound).
2. Open the `inbox.pawbucks.app` domain → the **DNS Records / Verify** screen.
3. Find the **TXT** record whose host/name is `resend._domainkey.inbox`. Copy its full value (it begins with `v=DKIM1; k=rsa; p=...` or just `p=MIGfMA0...`).
4. Keep this tab open — you'll paste it in Step 2.

> The DKIM public key verified earlier in this project was:
> `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCYiP51ulvXm98Jt+XRqdlb05cvDBNX5w2HJNWOfa2KMA8aBFt7YwatqjeWgczQYVeYuSa/BihI3XBNAuslJgRPKCxUQaIC4opcp66okM4vypCgW5b+X2bqzsIixUaAiLFwwPOoNNH/zR6TOS3ovYn96HxicYV0QZxpXbV65fWw5QIDAQAB`
> Confirm it matches what Resend shows in Step 0 before saving. If Resend shows the full `v=DKIM1; k=rsa; p=...` form, use that.

### Step 1 — Open Advanced DNS
1. Log in to **namecheap.com**.
2. Top bar → **Account** → **Domain List**.
3. Find `pawbucks.app` → click **Manage**.
4. Click the **Advanced DNS** tab.
5. You'll see your existing records, including the `inbox` MX. Leave it alone.

### Step 2 — Add the DKIM TXT record (record #2)
1. Click **Add New Record**.
2. Type: **TXT Record**
3. Host: `resend._domainkey.inbox`
4. Value: paste the DKIM value you copied from Resend in Step 0 (no quotes).
5. TTL: default / 30 min.
6. Click the **✓ (check)** to save.

### Step 3 — Add the `send.inbox` MX record (record #3)
1. Click **Add New Record**.
2. Type: **MX Record**
3. Host: `send.inbox`
4. Mail Server / Value: `feedback-smtp.us-east-1.amazonses.com`
5. Priority (MX Pref): `10`
6. Click **✓** to save.

### Step 4 — Add the `send.inbox` SPF TXT record (record #4)
1. Click **Add New Record**.
2. Type: **TXT Record**
3. Host: `send.inbox`
4. Value: `v=spf1 include:amazonses.com ~all`
5. TTL: default / 30 min.
6. Click **✓** to save.

### Step 5 — Confirm and save all changes
1. Confirm you now have 4 inbox-related records total (1 existing MX on `inbox`, plus the 3 you just added). The existing `inbox` MX is unchanged.
2. Scroll to the bottom of Advanced DNS and click **Save All Changes** if the button is shown (Namecheap usually saves each row on its check mark, but confirm there are no unsaved rows).
3. Nothing here should be flagged in red or duplicated.

## After the records are added
1. Wait for propagation — typically 15–60 minutes (DNS can take up to 72h in rare cases; Namecheap's TTL is usually faster).
2. In the Resend dashboard Inbound Emails screen, click **Verify** / **Verify Domain** on `inbox.pawbucks.app`. It should flip to **Verified / Active** once the records propagate.
3. Tell me once it's verified and I will:
   - Re-test the inbound pipeline end-to-end against `fiona@inbox.pawbucks.app` (and another active pet inbox).
   - Confirm the bounced 8:47 AM message can be re-sent and lands in the pet's inbox.
   - Re-check that outbound transactional + auth emails are still flowing normally.

## What NOT to do
- Do **not** delete or modify the existing `inbox` MX record.
- Do **not** add these records to the root `pawbucks.app` host — they belong on `inbox` / `send.inbox` / `resend._domainkey.inbox` only.
- Do **not** put quotes around TXT values.
- Do **not** add a trailing dot to MX values in Namecheap.
- If a Namecheap row for any host already exists (e.g. you somehow already have a TXT on `send.inbox`), **edit** it rather than creating a duplicate.
