# Resolve existing DNS records for `inbox.pawbucks.app` without duplicates

## Direct answer
Do **not** create duplicate DNS records.

If the DNS rows already exist in Namecheap with the same Host, Type, Value, and Priority listed below, leave them exactly as they are. The next step is verification in the email provider, not adding more records.

## What to check in Namecheap
In Namecheap → Domain List → `pawbucks.app` → Manage → Advanced DNS, compare your existing rows against this checklist:

| Type | Host | Value | Priority | What to do if it already exists |
|---|---|---|---:|---|
| MX | `inbox` | `inbound-smtp.us-east-1.amazonaws.com` | 10 | Leave it alone if it matches |
| TXT | `resend._domainkey.inbox` | DKIM value from the email provider | — | Leave it alone if it matches exactly; edit only if the value is different |
| MX | `send.inbox` | `feedback-smtp.us-east-1.amazonses.com` | 10 | Leave it alone if it matches |
| TXT | `send.inbox` | `v=spf1 include:amazonses.com ~all` | — | Leave it alone if it matches |

## Decision rule
- If a row with the same Type + Host + Value already exists: **do nothing**.
- If a row with the same Type + Host exists but the Value or Priority is different: **edit the existing row**, do not add another one.
- If a row is missing entirely: **add only that missing row**.
- If all four records already match: **do not touch DNS anymore**.

## Next step if all records already exist
1. Open the inbound email provider's domain verification screen for `inbox.pawbucks.app`.
2. Click **Verify** / **Verify Domain**.
3. If it still fails, the issue is likely one of these:
   - DNS propagation has not reached the verifier yet.
   - The provider is expecting a slightly different DKIM TXT value than the one in Namecheap.
   - The inbound domain is not attached/enabled correctly inside the provider, even though DNS is correct.

## What I checked
- The public website domain `pawbucks.app` is connected and active.
- The project's built-in email-domain status does not currently show `inbox.pawbucks.app` as a configured email domain, so this inbound setup appears to depend on the external inbound email provider verification rather than adding duplicate DNS records in Namecheap.

## What I will do after you confirm the records match
- Re-check the inbound setup path for `fiona@inbox.pawbucks.app`.
- Verify whether the provider sees the DNS records.
- Confirm whether the domain is enabled for receiving.
- Then retest inbound delivery end-to-end.
