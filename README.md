# FS25 Workflow Manager — Web Editor

**Live**: https://cschoch.github.io/FS25_WorkflowManagerWebeditor/

A standalone static web app to create and edit Workflow Manager workflows in the browser —
no game running, no build step, no dependencies. Deployable as a GitHub Page.

## Features (parity with the in-game editor)

- **Workflows**: create, rename, duplicate, delete, search
- **Steps**: all seven step types — AutoDrive, Courseplay, the sync markers
  *Wait for Leader* / *Unlock Follower*, and the targetless AutoDrive actions
  *Park* / *Refuel* / *Repair* (quick-add buttons, no dialog needed)
- **AutoDrive modes**: Drive To, Pickup & Deliver, Deliver, Load, Unload — with the same
  dynamic target / second-target labels as the in-game step dialog
- **Courseplay actions**: Field Work, Bale Collect
- **Fill types**: multi-select with search (full FS25 base list built in, custom mod
  fill type IDs can be typed in)
- **Support sub-steps**: nest support-vehicle steps under any main step, reorder them,
  edit and duplicate them (sync markers are not offered here — like in-game, leader/follower
  pairing is built from main steps only). A sub-step can be set to **finish before switching**:
  the support vehicle completes it before following the main vehicle to its next step
- **AD/CP settings** per workflow: Unload Fill Level (%), Pipe Offset (m), Pre-Call Level (%)
- **Reordering**: move buttons + drag & drop
- **Open savegame** (Chrome/Edge): pick the savegame folder once — its `workflowManager.xml` is
  loaded, and **Save to savegameN** writes straight back into it (File System Access API). The
  folder stays linked across reloads; if the game changed the file since it was loaded, Save asks
  before overwriting. **Reload** reads the savegame again (workflows and target lists) and only
  asks when the editor holds changes not yet saved to it. Firefox/Safari don't offer the API, so
  there these buttons are hidden
- **Import** `workflowManager.xml` (file picker or drop anywhere on the page) — old save
  formats (linked-workflow pairs, per-step sync flags) are migrated exactly like
  `WorkflowStorage.lua` does in-game
- **Export** a game-ready `workflowManager.xml` (formatVersion 2). It holds workflows only:
  the mod's options and the HUD position are stored per player by the game
  (`modSettings/FS25_WorkflowManager.xml`), so a `<settings>` block in an older file is ignored
- **Target suggestions**, one list set **per savegame**: with a linked savegame, Open/Reload
  read the AutoDrive destinations from its `AutoDrive_config.xml` and — once the Courseplay
  `Courses` folder is linked under Targets — the courses of its map (`Courses/<mapId>`, from
  `careerSavegame.xml`). AutoDrive names are `group/marker` like in the game's step dialog.
  Lists can also be maintained by hand or imported from an `AutoDrive_config.xml` / a map's
  course folder. Course files have no extension, so they're recognised by content. Course
  names are kept root-relative (`Singleplayer/F34/Kalken`), which is what the game matches on;
  a bare course name can resolve to another field's course
- **Autosave** to browser localStorage, **light/dark mode**, **English/German** UI

## Usage

1. Open the page (or `index.html` locally — no server needed).
2. Build your workflows.
3. Chrome/Edge: **Open savegame** → pick `.../My Games/FarmingSimulator2025/savegameN/` →
   edit → **Save to savegameN**. Done — no file copying. Changed something in-game? **Reload**.
4. Any browser: **Export XML** and place `workflowManager.xml` in your savegame folder
   (`.../My Games/FarmingSimulator2025/savegameN/`), replacing the existing file.
   This works while the game is running: the game re-reads the file every time the
   Workflow Manager window is opened. Workflows removed from the file are stopped.
5. Or start from your current file: **Import XML** first.

## GitHub Pages deployment

`.github/workflows/deploy-webeditor.yml` publishes this repo via GitHub Pages on every
push to `master`. One-time setup: repository **Settings → Pages → Source: GitHub Actions**.
