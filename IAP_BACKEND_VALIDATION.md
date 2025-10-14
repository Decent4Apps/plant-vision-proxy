# IAP Backend Validation

End-to-end guide for validating App Store / Play Store subscriptions on our backend and granting “Pro” in the app.

## Overview

- Mobile collects a purchase (`react-native-iap`) and POSTs it to our backend.
- Backend verifies with:
  - **Apple**: `verifyReceipt` (legacy) with shared secret, auto-routing to sandbox when needed (`21007`).
  - **Google**: `purchases.subscriptions.get` using a **service account** (JWT).
- Backend responds with a normalized entitlement (`active: true/false`, `expiresAt`, etc.).

## Endpoint

**POST** `/api/iap/verify`

### Request body (union)
```jsonc
// iOS
{
  "platform": "ios",
  "productId": "pro_monthly",
  "receipt": "<base64 transactionReceipt>",
  "environment": "auto" // optional: "auto" | "sandbox" | "production"
}

// Android
{
  "platform": "android",
  "productId": "pro_monthly",
  "purchaseToken": "<googlePurchaseToken>",
  "packageName": "<OPTIONAL override; defaults to env ANDROID_PACKAGE_NAME>"
}
