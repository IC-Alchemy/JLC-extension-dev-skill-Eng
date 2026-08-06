---
name: extension-dev-skill
description: >-
  AI Skill for building EasyEDA Pro extension plugins. Used when users need to create,
  modify, or debug EasyEDA Pro plugins, including generating plugin code,
  querying API documentation, configuring extension.json, and handling i18n localization.
  Trigger words: "EasyEDA", "嘉立创EDA", "EDA plugin", "EDA extension", "extension.json",
  "pro-api-types", "原理图", "PCB设计"
tags:
  - EDA
  - EasyEDA
  - plugin
  - extension
  - PCB
  - schematic
  - 嘉立创EDA
license: MIT
compatibility: Build requires Node.js 18+; runtime is EasyEDA Pro browser sandbox
metadata:
  author: JLCEDA
  version: "2.0.0"
---

# extension-dev-skill

AI Skill for building EasyEDA extension plugins. It combines live SDK type discovery, scenario recipes, runtime policy checks, and packaging/debugging workflow guidance.

## Evidence Priority

Use this order whenever generating or validating code:

1. Target project's `node_modules/@jlceda/pro-api-types/index.d.ts`: API existence, `eda` mount paths, signatures, overloads, return types, enums, inheritance, unions, type aliases, generics, and JSDoc stability tags.
2. `npm run build` diagnostics from the target plugin project: proof that generated code matches the installed SDK version and packaging requirements.
3. JSDoc from the declaration file: descriptions, parameter semantics, examples, and `@public` / `@beta` / `@alpha` maturity.
4. `recipes/` and `resources/experience.md`: scenario flow, editor-specific behavior, runtime pitfalls, and practices not expressible in types.
5. `resources/guide/`: concepts, packaging, i18n, extension.json, marketplace, and release guidance.

Do not treat Markdown reference files or recipes as authoritative for API structure. If docs and `index.d.ts` disagree, the current target project's `index.d.ts` wins for structure.

## Required API Query Tool

Use the skill's `scripts/eda-api.js` before writing code that calls `eda.*`. The skill itself must not vendor `node_modules`; the API type package must be installed in the target plugin project first.

```bash
cd <plugin-project>
npm install
node <skill-path>/scripts/eda-api.js doctor --project .
node <skill-path>/scripts/eda-api.js search --project . --name <keyword>
node <skill-path>/scripts/eda-api.js search --project . --member <method>
node <skill-path>/scripts/eda-api.js inspect --project . --mount <mount> --member <method> --closure
```

CLI rules:

- `--project` must point to the target plugin project, not the skill folder, unless the skill folder is temporarily being used as a test fixture.
- The CLI must resolve `@jlceda/pro-api-types` and `typescript` from the target plugin project's dependency tree. Missing package or declaration file is a hard failure.
- The CLI caches parsed type graphs in the target project at `node_modules/.cache/extension-dev-skill/` using package version, declaration SHA-256, TypeScript version, and schema version.
- Use `--format json` for machine-readable audits and `--format markdown` for human summaries.
- Exit codes: `0` success, `2` query not found, `3` validation errors, `4` environment error.

Before code generation, record the SDK proof in notes or final output:

```text
Verified against @jlceda/pro-api-types x.y.z + SHA-256 <hash>
```

## Type-Driven API Rules

- Never directly scan the whole 659 KB `index.d.ts` in model context. Query it through the CLI.
- Inspect every `eda.<mount>` you plan to call, and include `--closure` for parameters or return values involving interfaces, aliases, enums, or unions.
- Treat overloaded methods as separate declarations. Do not merge overloads into a single guessed signature.
- Exclude `private`, `protected`, and `@internal` members from generated code.
- `@public` is preferred. `@beta` and `@alpha` may be used only with an explicit compatibility warning.
- Union mounts must be handled carefully. For example, `sch_PrimitiveComponent` may resolve to `SCH_PrimitiveComponent | SCH_PrimitiveComponent3`; only common members are safe without narrowing.
- If a returned type is a union, inspect each branch before using branch-specific members.
- If a parameter or property uses an enum, inspect the enum values before writing literals.

## Scenario Recipes

Recipes are semantic workflows, not source-of-truth API references. When a recipe contains code, audit the involved mounts and members with `eda-api.js inspect --closure` before relying on it.

| recipe | scenario |
|---|---|
| `recipes/create_menu_plugin.md` | Create a plugin with menu registration and basic structure |
| `recipes/get_current_document.md` | Get active document info |
| `recipes/dmt_board_management.md` | Board management |
| `recipes/dmt_editor_control.md` | Editor tabs, split screen, zoom, markers |
| `recipes/dmt_project_management.md` | Project, team, folder, workspace management |
| `recipes/dmt_schematic_pcb_management.md` | Schematic pages, PCB docs, panel docs |
| `recipes/get_sch_components.md` | Schematic component listing |
| `recipes/modify_sch_component.md` | Schematic component modification |
| `recipes/export_sch_bom.md` | Schematic BOM export |
| `recipes/sch_wire_bus_operations.md` | Wires, buses, net info |
| `recipes/sch_pin_operations.md` | Component pins |
| `recipes/sch_primitives_bindraw.md` | Schematic drawing primitives |
| `recipes/sch_document_operations.md` | Schematic document operations |
| `recipes/sch_netlist_operations.md` | Netlist operations |
| `recipes/sch_drc_check.md` | Schematic DRC |
| `recipes/sch_event_bindraw.md` | Schematic events |
| `recipes/sch_select_control.md` | Schematic selection |
| `recipes/sch_manufacture_data.md` | Schematic manufacturing export |
| `recipes/sch_simulation_engine.md` | Simulation and SCH utilities |
| `recipes/get_pcb_components.md` | PCB component listing |
| `recipes/modify_pcb_primitive.md` | PCB primitive modification |
| `recipes/pcb_net_query.md` | PCB nets and net classes |
| `recipes/pcb_primitives_bindraw.md` | PCB drawing primitives |
| `recipes/pcb_document_operations.md` | PCB document operations |
| `recipes/pcb_layer_operations.md` | PCB layers |
| `recipes/pcb_select_control.md` | PCB selection |
| `recipes/pcb_drc_check.md` | PCB DRC and rules |
| `recipes/pcb_event_bindraw.md` | PCB events |
| `recipes/pcb_manufacture_data.md` | Gerber, BOM, pick-and-place, ordering |
| `recipes/pcb_math_polygon.md` | Polygon math |
| `recipes/lib_device_search.md` | Device search and device info |
| `recipes/lib_symbol_footprint.md` | Symbol and footprint library operations |
| `recipes/lib_libraries_management.md` | Library lists, categories, 3D models, CBB modules |
| `recipes/iframe_custom_ui.md` | Custom iframe UI and data exchange |
| `recipes/user_dialog_input.md` | Built-in dialogs |
| `recipes/sys_storage_operations.md` | Extension user config storage |
| `recipes/sys_http_request.md` | External HTTP requests |
| `recipes/sys_file_operations.md` | File operations |
| `recipes/sys_menu_shortcut.md` | Header menu and shortcuts |
| `recipes/sys_notification_message.md` | Toasts, message boxes, loading/progress |
| `recipes/sys_environment_info.md` | Version, theme, language |
| `recipes/sys_i18n_localization.md` | i18n |
| `recipes/sys_window_operations.md` | Windows, panels, right-click menu, message bus |
| `recipes/sys_timer_websocket.md` | Timer and WebSocket |
| `recipes/sys_format_conversion.md` | Import/export conversion |
| `recipes/sys_font_unit_tool.md` | Fonts, units, tools, logging |

## Execution Workflow

1. Understand the requested editor scope: home, schematic, PCB, footprint, panel, iframe, or mixed.
2. If no plugin project exists and the user asked to create one, initialize from the SDK and run `npm install`.
3. Run `node scripts/eda-api.js doctor --project <project>` and keep the package version/hash in mind.
4. Read a matching recipe when the task is workflow-oriented.
5. Query every API mount/member used by the plan with `inspect --closure`.
6. Present the implementation plan before creating or changing plugin code when the user has not already explicitly approved implementation.
7. Generate TypeScript with `PLUGIN_TAG`, `async/await`, defensive checks, and `try/catch` around logical EasyEDA API operations.
8. Run `npm run build`; the generated plugin must build successfully.
9. If `eext-dev-mcp` is available, import and debug the built `.eext`; otherwise tell the user where the build output is.

## Code Generation Standards

- Runtime is the EasyEDA browser sandbox, not Node.js.
- Use TypeScript and avoid `any` unless unavoidable.
- Define `const PLUGIN_TAG = '[PluginName]';` near the top of each generated source file.
- Prefer `async/await` over `.then()` chains.
- Wrap EasyEDA API operations in `try/catch`; log errors with `console.error(PLUGIN_TAG, ..., err)`.
- Use `console.warn` for non-fatal conditions and fallbacks.
- Do not use `console.log` in generated plugin code.
- Provide user-facing failure feedback with EasyEDA dialog/message APIs when appropriate.

Standard pattern:

```typescript
const PLUGIN_TAG = '[MyPlugin]';

export async function runFeature() {
  try {
    const docInfo = await eda.dmt_SelectControl.getCurrentDocumentInfo();
    if (!docInfo) {
      console.warn(PLUGIN_TAG, 'No active document found');
      return;
    }
  } catch (err) {
    console.error(PLUGIN_TAG, 'Feature failed:', err);
    await eda.sys_Dialog.showInformationMessage('Operation failed. Check console for details.');
  }
}
```

## Runtime Boundaries

Main process `src/`:

- No DOM APIs: `window`, `document`, `localStorage`, `sessionStorage`, host DOM manipulation.
- No Node APIs: `fs`, `path`, `child_process`, process filesystem access.
- Avoid npm packages that require DOM or Node APIs.
- Use `eda.sys_Dialog`, `eda.sys_Message`, `eda.sys_Storage`, `eda.sys_Window`, and related APIs.

Iframe `iframe/`:

- Browser APIs and browser-oriented npm packages are allowed.
- Import iframe dependencies normally and update `package.json`.
- Use bundled absolute paths such as `/iframe/index.html`; avoid relative resource paths in built iframe HTML.
- Main process and iframe windows are isolated. Pass data through EasyEDA storage/message APIs or call `eda` directly where available.

## i18n and Menus

- Menu titles in `extension.json` use plain text as the lookup key.
- Do not use `%key%` syntax in `extension.json` menu titles.
- Menu title translations live in `locales/extensionJson/en.json` and `locales/extensionJson/zh-Hans.json`.
- Code-level translations for `eda.sys_I18n.text()` live in `locales/en.json` and `locales/zh-Hans.json`.
- Header menu IDs must be unique across all editor pages and menu groups.

## Known Runtime Pitfalls

Validate the related API shape with `eda-api.js` before applying any pitfall rule; behavior notes may vary by SDK version and object variant.

- Current document info is commonly accessed through `dmt_SelectControl`; verify the current signature before use.
- Document type values commonly used by plugins: schematic page `1`, PCB `3`, footprint `4`.
- Schematic and PCB primitive mutation models can differ. Some schematic interfaces now expose `done()` and some mounts are unions, so inspect the exact return type before assuming a universal modify pattern.
- `openIFrame` paths should not include query parameters; pass state via storage or message APIs.
- `sys_Storage.getExtensionUserConfig` requires a key.
- Dialog information messages render plain text, not HTML; use iframe UI for rich output.
- Canvas primitive UUIDs and library UUIDs are different concepts.
- Pins/pads may not expose net getters; inspect the current primitive/interface before using net state.
- Abstract/general primitive mounts should not be assumed to expose every concrete primitive helper.

## Validation Expectations

For generated or modified plugin code:

- `node scripts/eda-api.js doctor --project <project>` succeeds.
- `inspect --closure` was run for each API family used.
- `npm run build` succeeds in the target plugin project.
- The final response includes SDK version/hash, changed files, and any validation that could not be run.

## Project Structure

Expected generated plugin structure:

```text
src/
iframe/
locales/
  extensionJson/
images/
build/
extension.json
package.json
eslint.config.mjs
tsconfig.json
README.md
CHANGELOG.md
```

## Do Not Modify

- `resources/guide/`
- `SKILL.md` front matter

## References

- CLI: `scripts/eda-api.js`
- Recipes: `recipes/`
- Runtime experience: `resources/experience.md`
- Guide: `resources/guide/`
- Legacy wrapper: `scripts/build-registry.js`
