---
name: pawaPay direct production
description: The YookPay pawaPay integration is direct API-only and runs against the live pawaPay environment.
---

YookPay must use pawaPay’s direct production API for Mobile Money deposits and payouts, not the hosted Checkout page.

**Why:** The product requirement is a server-to-server payment flow where the customer confirms on their operator phone; hosted Checkout is a different product flow.

**How to apply:** Keep pawaPay configured for production with a live token, use direct deposit/payout endpoints, and configure the deposit callback on the public YookPay deployment. Do not enable Checkout callbacks unless Checkout support is intentionally added.