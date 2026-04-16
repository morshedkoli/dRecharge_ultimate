# dRecharge Agent

Flutter Android agent for executing queued USSD jobs from the admin portal.

## What It Does

- Registers an Android device with a one-time admin-generated token.
- Signs the device into Firebase with an `agent` role.
- Polls the `executionQueue` collection for queued jobs.
- Acquires job locks through Cloud Functions.
- Executes the service USSD flow on-device.
- Reads recent SMS confirmations from the inbox.
- Reports the result back to the server so the transaction and queue status update.

## Required Device Setup

1. Install the APK on an Android phone.
2. Grant `Phone` and `SMS` permissions.
3. Enable the `dRecharge USSD Automation` accessibility service.
4. Generate a registration token from the admin portal and register the device in the app.

## Important Notes

- Multi-step USSD automation depends on the accessibility dialog structure exposed by the phone's dialer. Vendor-specific dialers may need small native adjustments.
- The Flutter app currently initializes Firebase with the project values already present in this repo. If you register a dedicated Android Firebase app later, update `lib/firebase_options.dart` with the Android `appId`.
- The debug APK produced by this workspace is at `build/app/outputs/flutter-apk/app-debug.apk`.
