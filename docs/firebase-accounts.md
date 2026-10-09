# Firebase accounts and training sync

## Publish the access rules

The app uses the default Firestore database in project bjj-data-viz-fb.
In Firebase Console, open Firestore Database → Rules, replace the rules with the contents of firestore.rules, then click Publish.
The checked-in rules permit verified users to read and write only their own profile and training records. All other paths are denied. Keep the database in production mode.

If using the Firebase CLI, firebase.json and .firebaserc already identify the project and rules file. Authenticate to the correct Firebase account before deploying rules.

## Account flow

Click the sidebar profile or the avatar in the top bar. Create a profile with a name, email and password, or log in to an existing account.
Verification and password reset emails use Firebase's hosted action handler. Keep the default email action URLs in Authentication → Templates unless implementing a custom handler.
After opening the verification email, return to the app and click “I’ve verified my email”. This reloads the user and refreshes their token before opening the cloud workspace.
Unverified users continue using guest browser data. Verified users use a separate account workspace.

## Data model

- users/{uid}: displayName and updatedAt. Passwords remain in Firebase Authentication.
- users/{uid}/records/{recordId}: kind (manual, imported, rank), data, fileName, revision, deleted, updatedAt.
- CSV sessions and promotions have content-derived IDs, independent of CSV row order.
- New manual sessions use UUID record IDs. Numeric IDs are retained only for compatibility with the existing UI.
- Deletions write a marker instead of physically removing the document, allowing other devices to fetch the deletion.

## Existing browser data

The account workspace offers “Import browser data”. This adds guest sessions and promotions without replacing existing account records. Matching records are deduplicated. Guest browser storage is preserved after import and logout.
Account CSV uploads are additive; guest CSV uploads continue replacing the guest CSV. Removing imported account data requires confirmation and removes imported sessions and promotions on every device, while retaining manual entries. Explicitly uploading a CSV again can restore its deleted records; importing guest data does not restore deleted records.

## Sync and conflicts

Each account has its own browser cache. On reconnect, the app queries records updated at or after the cache's most recent server timestamp. An empty cache or a new device downloads the full history. Live listeners receive subsequent changes. Browsers without available storage can still use cloud saves, but cannot retain this incremental cursor across reloads.
Edits and deletions use transactions and record revisions to reject stale changes. Edit forms retain the revision from when editing began. If a conflict is reported, reopen the latest entry before editing again.
Account saves require an online connection; the first version does not queue offline edits. A failed save keeps the form. Large imports use transactions of at most 100 records, so an interrupted import may be partially completed; retrying skips records already imported.

## Validation checklist

1. Publish firestore.rules and run npm run build locally.
2. Open a fresh browser profile. Create an account; confirm the verification email arrives.
3. Before verification, confirm guest training still works and cloud access is denied.
4. Verify, then check status in the profile. Confirm account training starts empty and guest import is offered when guest data exists.
5. Import browser data; confirm manual sessions, CSV sessions and promotions appear. Repeating the import must not add duplicates.
6. Log a manual session. Edit its notes, duration, rounds and focus. Refresh and confirm the data remains.
7. Log in from a second browser or device; confirm the same records load.
8. Open the same edit in both browsers. Save a change in the first, then save the stale form in the second; the second must report a conflict.
9. Delete a manual session; confirm it disappears from the other browser and stays deleted after reload.
10. Log out and sign in as another verified account. Confirm neither account sees the other's training; guest storage remains separate.
11. Test password reset, verification resend and an offline save attempt.

Automated cloud-model checks are in tests/cloudModel.test.mjs. Run them with node --test tests/cloudModel.test.mjs tests/cloudStorage.test.mjs. The rules and live auth/email flows still require Firebase/emulator verification; TypeScript and pure data tests do not establish that production rules have been deployed.
