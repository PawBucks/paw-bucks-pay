## Goal

Make the Merchant Workspace the single home for everything currently in the Merchant Dashboard. Today, several sidebar items (Sale Confirmations, Check-Ins, Subscribers, Sales Report, Daily History, Loyalty Program, Promotions, Brand Campaigns) link out to `/merchant-dashboard?tab=...`, which kicks the user back into the old layout. We will host that content directly inside the workspace.

## Approach

Render each former dashboard tab as its own page that uses `MerchantWorkspaceLayout` + `WorkspacePageHeader`, and update the sidebar to link to those new internal routes. The underlying tab components (`MerchantSaleConfirmationsTab`, `CheckInDashboard`, `MerchantSubscribersTab`, `MerchantLoyaltyProgramTab`, `MerchantDailySummaryTab`, `SalesReportGenerator`, `PromotionInvitationsInbox`, `MerchantBrandCampaignInbox` + `AvailableBrandCampaigns`, `MerchantPremiumServicesTab`, `MerchantQuickActionsTab`, `MerchantMessagesTab`, `MerchantOverviewTab` extras) are reused as‑is — only the wrapping page changes.

## New routes (added to `src/App.tsx`, lazy‑loaded, `ProtectedRoute allowedRoles={['merchant']}`)

- `/merchant/sale-confirmations`
- `/merchant/check-ins`
- `/merchant/subscribers`
- `/merchant/sales-report`
- `/merchant/daily-history`
- `/merchant/loyalty`
- `/merchant/promotions`
- `/merchant/brand-campaigns`
- `/merchant/premium-services`
- `/merchant/quick-actions`

Each page is a thin wrapper:

```text
<MerchantWorkspaceLayout>
  <WorkspacePageHeader section="…" title="…" subtitle="…" />
  <div className="p-4 md:p-6"> <TabComponent merchantId={…} /> </div>
</MerchantWorkspaceLayout>
```

Pages must fetch the current merchant id (same pattern used in `MerchantTaxVault`, `MerchantTransactions`, etc.) before rendering the inner component.

## Sidebar updates (`MerchantWorkspaceLayout.tsx`)

Re‑point every `?tab=` link to the new internal route, and add the missing items so the workspace sidebar mirrors the dashboard nav:

- Dashboard → Sale Confirmations → `/merchant/sale-confirmations`
- Dashboard → Check‑Ins → `/merchant/check-ins`
- Dashboard → Subscribers → `/merchant/subscribers`
- Dashboard → Sales Report → `/merchant/sales-report`
- Dashboard → Daily History → `/merchant/daily-history`
- Catalog & Services → Loyalty Program → `/merchant/loyalty`
- Catalog & Services → Premium Services → `/merchant/premium-services` (new)
- Catalog & Services → Quick Actions → `/merchant/quick-actions` (new)
- Marketing → Promotions → `/merchant/promotions`
- Marketing → Brand Campaigns → `/merchant/brand-campaigns`

The "Full Dashboard" link to `/merchant-dashboard` stays for now as an escape hatch during the transition; we will remove it in a follow‑up once the workspace is feature‑complete.

## Backwards compatibility

Keep `/merchant-dashboard` working (no removals in this pass) so existing emails, deep links, and notifications still resolve. The dashboard page itself is unchanged.

## Out of scope (this pass)

- Deleting `MerchantDashboard.tsx` or its route.
- Visual redesign of the embedded tab components — they will look the same as today, just hosted in the new chrome.
- Changes to backend, RLS, or any of the underlying tab components.

## Verification

- Build passes.
- Each new sidebar item navigates within the workspace shell (sidebar stays visible, no redirect to `/merchant-dashboard`).
- The active highlight resolves on the new routes.
