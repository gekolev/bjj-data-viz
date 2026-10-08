# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration


If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

### Manual training log

Open **Log training** (or `/log`) to record training without Gymdesk. Choose a date, Gi or No-Gi, duration, and session type, then save. Gym, instructor, and notes are optional. Your last choices are reused. Sessions can be edited or deleted and are included in the dashboard alongside CSV imports. Sample data is hidden once you start a manual log, including after deleting its last entry. Manual sessions are stored separately in localStorage on the current browser and device; clearing site data removes them. Storage failures are reported before changes are applied.

Manual entries also record start time, defaulting to the current device hour (:00). Date shortcuts, session type, focus, sparring rounds, effort, and recent gym/instructor buttons reduce typing. Optional detailed fields and the selected time persist across reloads and edits.
