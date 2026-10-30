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

Use Firebase Analytics > Events for event totals and DebugView/Realtime to validate collection. In the linked Google Analytics property, register event-scoped custom dimensions for page_name, chart_name, interaction_type, action, storage, and reason. Register custom metrics for session_count, rank_count, and skipped_rank_count if you need aggregate numerical reporting. Console menu labels may vary. Mark manual_session_saved and csv_import_succeeded as key events if these are your conversion goals.

page_visit is a custom navigation event, separate from automatically collected page_view. Do not add the two event totals together as page visits. Chart events measure interactions, not passive viewing. Each click and each change is a separate interaction.

No email addresses, names, training notes, gym/instructor names, search text, filenames, or CSV contents are explicitly included in custom event parameters. The SDK's existing automatic metadata collection remains in effect. Unsupported browsers or blocked analytics do not prevent app usage. Analytics calls are best-effort and not awaited by saving flows; counts can be lower than actual usage due to blockers or network failures.

Reference: https://firebase.google.com/docs/analytics/web/events
