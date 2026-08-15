---
name: Maviance test phone fields
description: Distinction between customer scenario numbers and operator service numbers in S3P collection requests.
---

Maviance S3P test data separates the phone that simulates the customer scenario from `serviceNumber`, which identifies the operator's configured service endpoint. For Cameroon Orange, the documented scenario numbers are not the operator service number; the service number is separately listed in the workbook.

**Why:** Sending the scenario number in both fields can produce a successful-looking collection response that never reaches a final status or never triggers the expected simulated confirmation.

**How to apply:** Keep `customerPhonenumber` as the selected test number (normalized with country code), and use the operator/country service-number mapping for `serviceNumber`. Add an explicit mapping when onboarding a new operator; do not derive it from the customer's phone.