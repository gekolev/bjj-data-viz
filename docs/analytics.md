# Product analytics

Firebase Analytics uses the existing measurement ID. Deploy the updated app to start collecting these events; historical interactions cannot be recovered.

| Event | Meaning | Parameters |
| --- | --- | --- |
| page_visit | Initial page or navigation, including browser back/forward | page_name |
| chart_expand | Open a chart full screen | chart_name |
| chart_replay | Replay chart animation | chart_name |
| chart_interaction | Click or control change inside a ChartFrame chart (not hover) | chart_name, interaction_type |
| manual_session_save_started | Valid manual create/edit submitted | action, storage |
| manual_session_saved | Persistence confirmed successful | action, storage |
| manual_session_save_failed | Persistence rejected or threw | reason |
| csv_import_started | File selected for import | none |
| csv_import_succeeded | Parsed CSV successfully persisted | session_count, rank_count, skipped_rank_count |
| csv_import_failed | Invalid extension, parsing failure, or save rejection | reason |
| client_context | One event when the app starts | viewport_width, viewport_height, pixel_ratio, orientation, color_scheme, input_type, display_mode |
| sign_up, login, logout | Account lifecycle using GA4 recommended names | method (where applicable) |
| password_reset_requested, auth_action_failed | Authentication support and broad failure category | method or action |
| demo_toggled, demo_load_failed | Demo adoption and load reliability | state or reason |
| filter_changed, filters_cleared, session_sort_changed, search | Session exploration without sending query text or selected private values | filter_type, filter_state, filter_count, sort_order, search_area |
| file_download, csv_import_removed | Template download and browser-import removal | fixed file metadata or storage |
| manual_session_deleted, manual_session_delete_failed | Manual record deletion outcome | storage, reason |
| select_content | Wrapped viewer opened using GA4's recommended content event | content_type, item_id, data_source |
| wrapped_export_succeeded, wrapped_export_failed | Wrapped card/recap export outcome | export_type, card_number, data_source, reason |
| wrapped_email_started, wrapped_email_succeeded, wrapped_email_failed | Wrapped delivery funnel without the email address | data_source, reason |
| account_records_deleted, account_records_delete_failed | Account training-history deletion outcome | none |
| theme_changed | Explicit theme selection | theme |

Use Firebase Analytics > Events for event totals and DebugView/Realtime to validate collection. In the linked Google Analytics property, register only the custom parameters you will actually use. Good event-scoped custom-dimension candidates are page_name, chart_name, interaction_type, action, storage, reason, orientation, color_scheme, input_type, display_mode, data_source, filter_type, filter_state, export_type, and search_area. Register custom metrics for session_count, rank_count, skipped_rank_count, viewport_width, viewport_height, and pixel_ratio if you need aggregate numerical reporting. Register `account_state`, `data_state`, and `has_rank_history` as user-scoped custom dimensions. Console menu labels may vary. Mark manual_session_saved and csv_import_succeeded as key events if these are your activation goals; consider sign_up and wrapped_email_succeeded only if those are meaningful product outcomes.

## Device and location reporting

Do not duplicate GA4's automatically collected dimensions in custom events. For web traffic, GA4 already derives country, region, city, browser, browser version, device category, device model, operating system/version, language, platform, and screen resolution. The app adds only context that is not conveniently available in the standard reports: viewport size, pixel ratio, orientation, preferred color scheme, primary input type, and browser/standalone display mode.

To view the built-in data in Google Analytics:

1. Open **Reports → User → User attributes → Demographic details** for country, region, and city.
2. Open **Reports → User → Tech → Tech details** for browser, OS, device category/model, platform, and screen resolution. If these reports are absent, an Editor or Administrator can add them through **Library**.
3. Use **Explore → Free form** to combine dimensions. Useful rows are `Country`, `Operating system`, `Device category`, and `Screen resolution`; useful values are `Users`, `Sessions`, `Engaged sessions`, and `Key events`.
4. Add an event-name filter such as `page_visit`, `manual_session_saved`, or `csv_import_succeeded` when you want the device/location breakdown for a particular action.

The app assigns Firebase Authentication's opaque UID through GA4 User-ID for signed-in accounts and clears it for guests. It never sends an email address as User-ID. This enables cross-device journey reporting after User-ID is enabled in the GA4 property. `account_state` provides a signed-in/guest breakdown; `data_state` segments empty, demo, imported, manual, and mixed workspaces; `has_rank_history` is a yes/no product-context property.

Approximate geography is derived by Google from the request IP; the app does not request GPS permission, store coordinates, or send raw IP addresses. Avoid adding exact location, full user-agent strings, emails, names, filenames, search text, training notes, gym names, or instructor names to Analytics.

## Property configuration checklist

1. In **Admin → Data collection and modification → Custom definitions**, create the dimensions and metrics listed above. Custom definitions affect reporting from creation onward; they do not backfill older events.
2. In **Admin → Data collection and modification → Data streams → Web**, verify Enhanced measurement is enabled for the measurements you want.
3. In **Admin → Data display → Reporting identity**, choose a reporting identity appropriate for User-ID if you want cross-device reporting.
4. Set a data-retention period appropriate for the product and document Analytics in the site's privacy notice.
5. Configure consent before Analytics storage where required by the visitor's jurisdiction. The current implementation initializes Analytics immediately in production; deployment in regions requiring prior consent should add a consent-management flow before relying on this data.

page_visit is a custom navigation event, separate from automatically collected page_view. Do not add the two event totals together as page visits. Chart events measure interactions, not passive viewing. Each click and each change is a separate interaction.

No email addresses, names, training notes, gym/instructor names, search text, filenames, or CSV contents are explicitly included in custom event parameters. The SDK's existing automatic metadata collection remains in effect. Unsupported browsers or blocked analytics do not prevent app usage. Analytics calls are best-effort and not awaited by saving flows; counts can be lower than actual usage due to blockers or network failures.

Reference: https://firebase.google.com/docs/analytics/web/events

Analytics is disabled in Vite development mode and on localhost, *.localhost, 127.* loopback, IPv6 loopback, and 0.0.0.0, including locally previewed production builds. The SDK is not initialized in these environments, so automatic and custom events are disabled.
