# Firebase Analytics

The app initializes Firebase Analytics once at startup when the browser supports it. The Firebase configuration in `src/lib/firebase.ts` uses project `bjj-data-viz-fb` and measurement ID `G-HVPBPWNFHH`. Authentication and Firestore alone do not initialize Analytics.

1. Open Firebase Console and select `bjj-data-viz-fb`.
2. Open **Project settings → Integrations** and confirm Google Analytics is enabled and linked to the intended Google Analytics property.
3. In **Project settings → General → Your apps**, select the web app and compare its `measurementId` with the one in `src/lib/firebase.ts`.
4. Build and deploy the updated app, then visit the deployed website. Analytics starts collecting after this code runs; it cannot recover earlier visits.
5. Open the linked Google Analytics property's **Reports → Realtime** to check incoming activity.
6. For detailed verification, enable the Google Analytics Debugger Chrome extension, refresh your website, and open **Analytics → DebugView** in Firebase Console.

If nothing arrives, temporarily disable tracking blockers for your test session and inspect browser Network requests for `g/collect`. Check that you are viewing the property linked to this web app. Standard reports can take longer to populate than Realtime and DebugView.

This setup enables automatically collected web events. Business actions such as CSV imports and manual training saves require separate `logEvent` instrumentation.

Official references: [Web setup](https://firebase.google.com/docs/analytics/web/get-started) and [DebugView](https://firebase.google.com/docs/analytics/debugview).
