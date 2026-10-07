/* FS25 Workflow Manager — Web Editor
   Standalone static app: edits workflows compatible with the in-game
   WorkflowStorage.lua format (workflowManager.xml, formatVersion 2). */

"use strict";

/* ============================================================
   Constants (mirror src/WorkflowManager.lua)
   ============================================================ */

const STEP_AUTODRIVE = "autodrive";
const STEP_COURSEPLAY = "courseplay";
const STEP_WAIT_FOR_LEADER = "wait_for_leader";
const STEP_UNLOCK_FOLLOWER = "unlock_follower";
const STEP_PARK = "park";
const STEP_REFUEL = "refuel";
const STEP_REPAIR = "repair";

const STEP_TYPES = [STEP_AUTODRIVE, STEP_COURSEPLAY, STEP_WAIT_FOR_LEADER, STEP_UNLOCK_FOLLOWER, STEP_PARK, STEP_REFUEL, STEP_REPAIR];
const AD_ACTIONS = ["drive", "pickup_deliver", "deliver", "load", "unload"];
const CP_ACTIONS = ["fieldwork", "bale_collect"];

// "Marker" here means "no target/action fields" (sync markers, plus Park/Refuel/Repair,
// which AD resolves automatically) — mirrors WorkflowManager:isTargetlessStepType in-game.
const isMarkerType = (t) => t === STEP_WAIT_FOR_LEADER || t === STEP_UNLOCK_FOLLOWER
  || t === STEP_PARK || t === STEP_REFUEL || t === STEP_REPAIR;
// Leader/follower sync markers only — mirrors WorkflowManager:isMarkerStepType in-game.
const isSyncMarkerType = (t) => t === STEP_WAIT_FOR_LEADER || t === STEP_UNLOCK_FOLLOWER;
const actionNeedsUnloadTarget = (type, action) =>
  type === STEP_AUTODRIVE && (action === "unload" || action === "pickup_deliver" || action === "load");
const actionNeedsFillType = (type, action) =>
  type === STEP_AUTODRIVE && (action === "pickup_deliver" || action === "load");
// Seed type is a Courseplay field-work option only — mirrors WMStepDialog:actionNeedsSeedType.
const actionNeedsSeedType = (type, action) =>
  type === STEP_COURSEPLAY && action === "fieldwork";

/* ============================================================
   i18n (labels match translations/translation_en.xml / _de.xml)
   ============================================================ */

const I18N = {
  en: {
    appTitle: "Workflow Manager", appSubtitle: "FS25 Web Editor",
    targetsBtn: "Targets", importBtn: "Import XML", exportBtn: "Export XML",
    searchPlaceholder: "Search workflows…", newWorkflow: "New workflow",
    emptyTitle: "Plan your farm's day — before you even start the game",
    emptyText: "Create AutoDrive &amp; Courseplay workflows here, then export <code>workflowManager.xml</code> into your savegame folder.",
    emptyTextOpen: "Open a savegame folder, or the whole FarmingSimulator2025 folder, to edit its workflows in place. Or start a new AutoDrive &amp; Courseplay workflow here.",
    emptyHint: "Tip: you can also drop a workflowManager.xml file anywhere on this page.",
    namePlaceholder: "Workflow name", duplicate: "Duplicate", delete: "Delete", cancel: "Cancel",
    save: "Save", add: "Add", done: "Done", replace: "Replace",
    adSettingsTitle: "AD / CP Settings",
    adSettingsHint: "Per-workflow AutoDrive overrides. Leave a field empty to use AutoDrive's own setting.",
    unloadFill: "Unload Fill Level", pipeOffset: "Pipe Offset", preCall: "Pre-Call Level",
    steps: "Steps", addStep: "Add step", addSupport: "Add support step",
    noSteps: "No steps defined. Click “Add step” to create the first one.",
    typeAd: "AutoDrive", typeCp: "Courseplay", typeWait: "Wait for Leader", typeUnlock: "Unlock Follower",
    typePark: "Park", typeRefuel: "Refuel", typeRepair: "Repair",
    jobLegend: "What does the vehicle do?", syncGroup: "Sync markers",
    target: "Target", course: "Course",
    pickup: "Pickup", loadAt: "Load At", unloadFirst: "Unload", deliverTo: "Deliver To", returnTo: "Return To",
    fillTypes: "Fill Types", fillSearchPh: "Search fill types…",
    seedType: "Seed Type", seedTypeNone: "None (keep current)",
    finishBeforeSwitch: "Finish before switching",
    finishBeforeSwitchHint: "When the main vehicle moves on to its next step while this support step runs, finish it first, then follow the main vehicle.",
    dialogAddStep: "Add Step", dialogEditStep: "Edit Step",
    dialogAddSupport: "Add Support Step", dialogEditSupport: "Edit Support Step",
    prevStep: (n) => `Previous step (${n})`, nextStep: (n) => `Next step (${n})`,
    markerWaitInfo: "Sync marker: the vehicle waits here until its leader passes the matching “Unlock Follower” marker. No target or action needed.",
    markerUnlockInfo: "Sync marker: passing this step releases followers waiting at their matching “Wait for Leader” marker. No target or action needed.",
    parkInfo: "Drives to the vehicle's AutoDrive park position (attached implements are checked first — the one furthest behind the vehicle wins — then the vehicle itself). No target or action needed — configure the park position in AutoDrive.",
    refuelInfo: "Drives to the nearest AutoDrive-reachable fuel station matching the vehicle's fuel type. No target or action needed. If the vehicle is already fueled or no station is reachable, the step completes immediately instead of failing.",
    repairInfo: "Drives to the nearest AutoDrive-reachable workshop and repairs the vehicle. No target or action needed. Fails if no repair station is reachable.",
    actionNames: {
      drive: "Drive To", pickup_deliver: "Pickup and Deliver", deliver: "Deliver",
      load: "Load", unload: "Unload Combine", fieldwork: "Field Work", bale_collect: "Bale Collect",
    },
    targetsTitle: "Targets & Courses",
    targetsHint: "Step dialogs suggest these names as you type. Names your workflows use are always listed.",
    targetsScope: (d) => `For ${d}`, targetsScopeNone: "No savegame open — these lists apply until you open one",
    tgAdTitle: "Destinations", tgCpTitle: "Courses",
    addDestPh: "Filter or add a destination…", addCoursePh: "Filter or add a course…",
    importAdConfig: "Import file", importCpCourses: "Import folder",
    importAdTitle: "Add the destinations of an AutoDrive_config.xml — it's in your savegame folder.",
    importCpTitle: "Pick your map's folder inside …/modSettings/FS25_Courseplay/Courses — the folder structure is part of the course name.",
    linkCpFolder: "Link folder", relinkCpFolder: "Change folder",
    linkCpFolderTitle: "Pick …/modSettings/FS25_Courseplay/Courses (covers every map) or one map's folder inside it, e.g. Courses/FS25_NDL.NDL (that map only).",
    tgAdSourceLinked: (d) => `Read from AutoDrive_config.xml in ${d} when you open or reload it.`,
    tgAdSourceOpen: "Open a savegame to read its destinations, or import an AutoDrive_config.xml.",
    tgAdSourceManual: "Import the AutoDrive_config.xml from your savegame folder, or type names below.",
    tgCpSourceUnlinked: "Link Courseplay's Courses folder once — every savegame then gets the courses of its map.",
    tgCpSourceLinked: "Read from the linked Courses folder, for the savegame's map, when you open or reload it.",
    tgCpSourceMap: (m) => `Linked to map ${m} only. Link the Courses folder itself to cover every map.`,
    tgCpSourceManual: "Import your map's folder from …/modSettings/FS25_Courseplay/Courses, or type names below.",
    tgCountFiltered: (n, total) => `${n} of ${total}`,
    tgNoMatch: (q) => `No match. Press Enter to add “${q}”.`,
    tgAdEmpty: "No destinations yet.", tgCpEmpty: "No courses yet.",
    tgAdNoGroup: "No group", tgCpNoGroup: "No folder",
    tgRemove: (n) => `Remove ${n}`, remove: "Remove",
    tgRemoveGroupAd: (g) => `Remove group ${g} and its destinations`,
    tgRemoveGroupCp: (g) => `Remove folder ${g} and its courses`,
    confirmRemoveGroupAd: (g, n) => `Remove group “${g}” and its ${n} destinations?`,
    confirmRemoveGroupCp: (g, n) => `Remove folder “${g}” and its ${n} courses?`,
    tgClear: "Clear", tgClearTitle: "Remove every entry listed below",
    confirmClearAd: (n) => `Remove all ${n} destinations from this list?`,
    confirmClearCp: (n) => `Remove all ${n} courses from this list?`,
    confirmClearFiltered: (n, q) => `Remove the ${n} entries matching “${q}”?`,
    tgComesBack: " Open savegame and Reload read them in again.",
    noEntries: "No entries yet",
    noMatches: "No matches — free text is kept as-is",
    targetHintAd: "AutoDrive destination as the game lists it (group/marker name). Manage suggestions under “Targets”.",
    targetHintCp: "Courseplay course name (with folder prefix if used). Manage suggestions under “Targets”.",
    confirmDeleteWf: (n, steps) => steps ? `Delete workflow “${n}” and its ${steps} step${steps === 1 ? "" : "s"}?` : `Delete workflow “${n}”?`,
    confirmDeleteStep: "Delete this step (including its support steps)?",
    confirmDeleteSupport: "Delete this support step?",
    confirmImportReplace: (n) => `Replace the ${n} workflow(s) in this editor with the imported file? Unexported changes are lost.`,
    copySuffix: "(Copy)", newWfName: "New Workflow", unnamed: "Unnamed",
    stepCount: (n) => `${n} step${n === 1 ? "" : "s"}`,
    wfCount: (n) => `${n} workflow${n === 1 ? "" : "s"}`,
    toastImported: (n) => `Imported ${n} workflow(s)`,
    toastImportFailed: "Import failed: not a valid workflowManager.xml",
    toastExported: "workflowManager.xml downloaded — place it in your savegame folder",
    toastNothingToExport: "Nothing to export — create a workflow first",
    toastAdImported: (n) => `Imported ${n} AutoDrive destination(s)`,
    toastAdImportFailed: "No map markers found in that file",
    toastCpImported: (n) => `Imported ${n} course name(s)`,
    toastMigrated: "Old save format detected — migrated automatically",
    settingsSet: (n) => `${n} override(s) set`, settingsNone: "using AutoDrive defaults",
    validationMissingTarget: "Target missing",
    validationMarkerInSupport: "Sync markers can't run as support sub-steps — change the type or delete this row",
    metaId: "ID", supportStepCount: (n) => `${n} support step${n === 1 ? "" : "s"}`,
    moveUp: "Move up", moveDown: "Move down", edit: "Edit", langName: "EN",
    dropHere: "Drop workflowManager.xml to import",
    dropHereFolder: "Drop a savegame folder to open it, or workflowManager.xml to import",
    emptyHintFolder: "Tip: you can also drop a savegame folder or a workflowManager.xml file anywhere on this page.",
    openSavegameBtn: "Open savegame",
    openSavegameTitle: "Pick a savegame folder (…/FarmingSimulator2025/savegameN), or the FarmingSimulator2025 folder itself to also find Courseplay's courses. Its workflowManager.xml is loaded and Save writes straight back into it.",
    saveToBtn: (d) => `Save to ${d}`,
    saveToTitle: (d) => `Write workflowManager.xml directly into ${d}. The game picks it up the next time the Workflow Manager window opens.`,
    overwrite: "Overwrite",
    confirmOverwriteChanged: (d) => `workflowManager.xml in ${d} was changed since it was loaded here (e.g. saved in-game). Overwrite it? Use “Open savegame” to load the newer file instead.`,
    toastSaved: (d) => `Saved to ${d}/workflowManager.xml`,
    toastSaveFailed: (d) => `Could not write to ${d} — check the folder still exists and access is allowed`,
    toastSavegameReadFailed: "Could not read that folder",
    toastSavegameNoFile: (d) => `${d} has no workflowManager.xml yet — Save will create it`,
    toastNotSavegame: (d) => `${d} is neither a savegame folder (no careerSavegame.xml) nor the FarmingSimulator2025 folder`,
    toastNoSavegames: (d) => `No savegames in ${d} yet`,
    toastCpFound: "Courseplay's Courses folder found and linked",
    sgTitle: "Open which savegame?",
    sgScope: (d) => `In ${d}, most recently saved first`,
    sgNameSlot: (n, slot) => `${n}, ${slot}`,
    sgOpenNow: "Open now", sgHasWorkflows: "Has workflows",
    tgAdNeedMissing: (d) => `No AutoDrive_config.xml in ${d}, but your workflows use AutoDrive. AutoDrive writes it when the game is saved — import one by hand, or type destinations below.`,
    tgAdNeedFailed: "AutoDrive_config.xml could not be read. Import it by hand, or type destinations below.",
    tgCpNeedUnlinked: "Courses are kept outside the savegame, so they could not be found. Link …/FarmingSimulator2025/\u200BmodSettings/\u200BFS25_Courseplay/\u200BCourses once — or open the FarmingSimulator2025 folder instead of a savegame, which finds it by itself.",
    tgCpNeedPermission: "The browser needs your permission again to read the linked Courses folder.",
    tgCpNeedOtherMap: (linked, m) => `The linked folder only holds map ${linked}, this savegame plays ${m}. Link the Courses folder itself to cover every map.`,
    tgCpNeedFailed: "The linked Courses folder could not be read — it may have moved. Link it again.",
    allowAccess: "Allow access",
    reloadBtn: "Reload",
    reloadTitle: (d) => `Read workflowManager.xml, AutoDrive destinations and Courseplay courses from ${d} again — e.g. after changing them in-game.`,
    confirmReloadDiscard: (d) => `Reload from ${d}? Changes made here that were not saved to ${d} are lost.`,
    toastAdScanned: (n) => `${n} AutoDrive destination(s) read from AutoDrive_config.xml`,
    toastCpScanned: (n, m) => `${n} Courseplay course(s) found for map ${m}`,
    toastCpLinked: "Courseplay folder linked",
    toastNotCoursesFolder: (d) => `${d} is neither Courseplay's “Courses” folder (…/modSettings/FS25_Courseplay/Courses) nor a map folder inside it`,
  },
  de: {
    appTitle: "Workflow Manager", appSubtitle: "FS25 Web-Editor",
    targetsBtn: "Ziele", importBtn: "XML importieren", exportBtn: "XML exportieren",
    searchPlaceholder: "Workflows suchen…", newWorkflow: "Neuer Workflow",
    emptyTitle: "Plane den Hoftag — noch bevor das Spiel startet",
    emptyText: "Erstelle hier AutoDrive- &amp; Courseplay-Workflows und exportiere <code>workflowManager.xml</code> in deinen Spielstand-Ordner.",
    emptyTextOpen: "Öffne einen Spielstand-Ordner oder gleich den ganzen Ordner FarmingSimulator2025, um seine Workflows direkt zu bearbeiten. Oder lege hier einen neuen AutoDrive- &amp; Courseplay-Workflow an.",
    emptyHint: "Tipp: Du kannst eine workflowManager.xml auch einfach auf diese Seite ziehen.",
    namePlaceholder: "Workflow-Name", duplicate: "Duplizieren", delete: "Löschen", cancel: "Abbrechen",
    save: "Speichern", add: "Hinzufügen", done: "Fertig", replace: "Ersetzen",
    adSettingsTitle: "AD / CP Einstellungen",
    adSettingsHint: "AutoDrive-Überschreibungen pro Workflow. Leere Felder verwenden die AutoDrive-Einstellung.",
    unloadFill: "Abladen ab Level", pipeOffset: "Offset Rohr", preCall: "Vorab-Ruf Level",
    steps: "Schritte", addStep: "Schritt hinzufügen", addSupport: "Unterstützungsschritt hinzufügen",
    noSteps: "Keine Schritte definiert. Klicke auf „Schritt hinzufügen“.",
    typeAd: "AutoDrive", typeCp: "Courseplay", typeWait: "Auf Anführer warten", typeUnlock: "Folger freigeben",
    typePark: "Parken", typeRefuel: "Auftanken", typeRepair: "Reparieren",
    jobLegend: "Was macht das Fahrzeug?", syncGroup: "Sync-Marker",
    target: "Ziel", course: "Kurs",
    pickup: "Abholung", loadAt: "Beladen bei", unloadFirst: "Entladen", deliverTo: "Liefern an", returnTo: "Zurück zu",
    fillTypes: "Fülltypen", fillSearchPh: "Fülltypen suchen…",
    seedType: "Saatgut", seedTypeNone: "Keines (unverändert)",
    finishBeforeSwitch: "Vor dem Wechsel abschließen",
    finishBeforeSwitchHint: "Wechselt das Hauptfahrzeug zu seinem nächsten Schritt, während dieser Unterstützungsschritt läuft, wird er erst beendet, dann folgt das Fahrzeug.",
    dialogAddStep: "Schritt hinzufügen", dialogEditStep: "Schritt bearbeiten",
    dialogAddSupport: "Unterstützungsschritt hinzufügen", dialogEditSupport: "Unterstützungsschritt bearbeiten",
    prevStep: (n) => `Vorheriger Schritt (${n})`, nextStep: (n) => `Nächster Schritt (${n})`,
    markerWaitInfo: "Sync-Marker: Das Fahrzeug wartet hier, bis sein Anführer den passenden „Folger freigeben“-Marker passiert. Kein Ziel/keine Aktion nötig.",
    markerUnlockInfo: "Sync-Marker: Beim Passieren dieses Schritts werden Folger freigegeben, die an ihrem „Auf Anführer warten“-Marker warten. Kein Ziel/keine Aktion nötig.",
    parkInfo: "Fährt zur in AutoDrive konfigurierten Parkposition des Fahrzeugs (zuerst werden die angehängten Geräte geprüft — das am weitesten hinten liegende gewinnt — dann das Fahrzeug selbst). Kein Ziel/keine Aktion nötig — die Parkposition wird in AutoDrive konfiguriert.",
    refuelInfo: "Fährt zur nächsten über AutoDrive erreichbaren Tankstelle für den benötigten Kraftstofftyp. Kein Ziel/keine Aktion nötig. Ist das Fahrzeug bereits betankt oder keine Tankstelle erreichbar, wird der Schritt sofort abgeschlossen statt fehlzuschlagen.",
    repairInfo: "Fährt zur nächsten über AutoDrive erreichbaren Werkstatt und repariert das Fahrzeug. Kein Ziel/keine Aktion nötig. Schlägt fehl, wenn keine Werkstatt erreichbar ist.",
    actionNames: {
      drive: "Fahren zu", pickup_deliver: "Abholen und Liefern", deliver: "Abladen",
      load: "Abholen", unload: "Drescher abfahren", fieldwork: "Feldarbeit", bale_collect: "Ballen sammeln",
    },
    targetsTitle: "Ziele & Kurse",
    targetsHint: "Die Schritt-Dialoge schlagen diese Namen beim Tippen vor. Namen aus deinen Workflows sind immer dabei.",
    targetsScope: (d) => `Für ${d}`, targetsScopeNone: "Kein Spielstand geöffnet — diese Listen gelten, bis du einen öffnest",
    tgAdTitle: "Ziele", tgCpTitle: "Kurse",
    addDestPh: "Ziel filtern oder hinzufügen…", addCoursePh: "Kurs filtern oder hinzufügen…",
    importAdConfig: "Datei importieren", importCpCourses: "Ordner importieren",
    importAdTitle: "Übernimmt die Ziele einer AutoDrive_config.xml — sie liegt in deinem Spielstand-Ordner.",
    importCpTitle: "Wähle den Ordner deiner Karte in …/modSettings/FS25_Courseplay/Courses — die Ordnerstruktur ist Teil des Kursnamens.",
    linkCpFolder: "Ordner verknüpfen", relinkCpFolder: "Ordner ändern",
    linkCpFolderTitle: "Wähle …/modSettings/FS25_Courseplay/Courses (deckt alle Karten ab) oder den Ordner einer Karte darin, z. B. Courses/FS25_NDL.NDL (nur diese Karte).",
    tgAdSourceLinked: (d) => `Wird beim Öffnen und Neuladen aus der AutoDrive_config.xml in ${d} gelesen.`,
    tgAdSourceOpen: "Öffne einen Spielstand, um seine Ziele zu lesen, oder importiere eine AutoDrive_config.xml.",
    tgAdSourceManual: "Importiere die AutoDrive_config.xml aus deinem Spielstand-Ordner oder tippe Namen unten ein.",
    tgCpSourceUnlinked: "Verknüpfe einmalig Courseplays Ordner „Courses“ — jeder Spielstand bekommt dann die Kurse seiner Karte.",
    tgCpSourceLinked: "Wird beim Öffnen und Neuladen für die Karte des Spielstands aus dem verknüpften Ordner „Courses“ gelesen.",
    tgCpSourceMap: (m) => `Nur mit Karte ${m} verknüpft. Verknüpfe den Ordner „Courses“ selbst, um alle Karten abzudecken.`,
    tgCpSourceManual: "Importiere den Ordner deiner Karte aus …/modSettings/FS25_Courseplay/Courses oder tippe Namen unten ein.",
    tgCountFiltered: (n, total) => `${n} von ${total}`,
    tgNoMatch: (q) => `Kein Treffer. Enter fügt „${q}“ hinzu.`,
    tgAdEmpty: "Noch keine Ziele.", tgCpEmpty: "Noch keine Kurse.",
    tgAdNoGroup: "Ohne Gruppe", tgCpNoGroup: "Ohne Ordner",
    tgRemove: (n) => `${n} entfernen`, remove: "Entfernen",
    tgRemoveGroupAd: (g) => `Gruppe ${g} mit ihren Zielen entfernen`,
    tgRemoveGroupCp: (g) => `Ordner ${g} mit seinen Kursen entfernen`,
    confirmRemoveGroupAd: (g, n) => `Gruppe „${g}“ mit ihren ${n} Zielen entfernen?`,
    confirmRemoveGroupCp: (g, n) => `Ordner „${g}“ mit seinen ${n} Kursen entfernen?`,
    tgClear: "Leeren", tgClearTitle: "Alle unten gelisteten Einträge entfernen",
    confirmClearAd: (n) => `Alle ${n} Ziele aus dieser Liste entfernen?`,
    confirmClearCp: (n) => `Alle ${n} Kurse aus dieser Liste entfernen?`,
    confirmClearFiltered: (n, q) => `Die ${n} Einträge entfernen, die „${q}“ enthalten?`,
    tgComesBack: " „Spielstand öffnen“ und „Neu laden“ lesen sie wieder ein.",
    noEntries: "Noch keine Einträge",
    noMatches: "Keine Treffer — Freitext wird übernommen",
    targetHintAd: "AutoDrive-Ziel wie im Spiel gelistet (Gruppe/Markername). Vorschläge unter „Ziele“ verwalten.",
    targetHintCp: "Courseplay-Kursname (ggf. mit Ordner-Präfix). Vorschläge unter „Ziele“ verwalten.",
    confirmDeleteWf: (n, steps) => steps ? `Workflow „${n}“ mit ${steps} Schritt${steps === 1 ? "" : "en"} löschen?` : `Workflow „${n}“ löschen?`,
    confirmDeleteStep: "Diesen Schritt (inkl. Unterstützungsschritte) löschen?",
    confirmDeleteSupport: "Diesen Unterstützungsschritt löschen?",
    confirmImportReplace: (n) => `Die ${n} Workflow(s) im Editor durch die importierte Datei ersetzen? Nicht exportierte Änderungen gehen verloren.`,
    copySuffix: "(Kopie)", newWfName: "Neuer Workflow", unnamed: "Unbenannt",
    stepCount: (n) => `${n} Schritt${n === 1 ? "" : "e"}`,
    wfCount: (n) => `${n} Workflow${n === 1 ? "" : "s"}`,
    toastImported: (n) => `${n} Workflow(s) importiert`,
    toastImportFailed: "Import fehlgeschlagen: keine gültige workflowManager.xml",
    toastExported: "workflowManager.xml heruntergeladen — in den Spielstand-Ordner legen",
    toastNothingToExport: "Nichts zu exportieren — erstelle zuerst einen Workflow",
    toastAdImported: (n) => `${n} AutoDrive-Ziel(e) importiert`,
    toastAdImportFailed: "Keine Kartenmarker in der Datei gefunden",
    toastCpImported: (n) => `${n} Kursname(n) importiert`,
    toastMigrated: "Altes Speicherformat erkannt — automatisch migriert",
    settingsSet: (n) => `${n} Überschreibung(en) gesetzt`, settingsNone: "AutoDrive-Standard",
    validationMissingTarget: "Ziel fehlt",
    validationMarkerInSupport: "Sync-Marker funktionieren nicht als Unterstützungsschritt — Typ ändern oder Zeile löschen",
    metaId: "ID", supportStepCount: (n) => `${n} Unterstützungsschritt${n === 1 ? "" : "e"}`,
    moveUp: "Nach oben", moveDown: "Nach unten", edit: "Bearbeiten", langName: "DE",
    dropHere: "workflowManager.xml zum Importieren ablegen",
    dropHereFolder: "Spielstand-Ordner zum Öffnen ablegen, oder workflowManager.xml zum Importieren",
    emptyHintFolder: "Tipp: Du kannst auch einen Spielstand-Ordner oder eine workflowManager.xml irgendwo auf dieser Seite ablegen.",
    openSavegameBtn: "Spielstand öffnen",
    openSavegameTitle: "Wähle einen Spielstand-Ordner (…/FarmingSimulator2025/savegameN) oder den Ordner FarmingSimulator2025 selbst, um auch Courseplays Kurse zu finden. Seine workflowManager.xml wird geladen und Speichern schreibt direkt dorthin zurück.",
    saveToBtn: (d) => `In ${d} speichern`,
    saveToTitle: (d) => `workflowManager.xml direkt in ${d} schreiben. Das Spiel übernimmt sie beim nächsten Öffnen des Workflow-Manager-Fensters.`,
    overwrite: "Überschreiben",
    confirmOverwriteChanged: (d) => `Die workflowManager.xml in ${d} wurde geändert, seit sie hier geladen wurde (z. B. im Spiel gespeichert). Überschreiben? Mit „Spielstand öffnen“ lädst du stattdessen die neuere Datei.`,
    toastSaved: (d) => `In ${d}/workflowManager.xml gespeichert`,
    toastSaveFailed: (d) => `Schreiben nach ${d} fehlgeschlagen — existiert der Ordner noch und ist der Zugriff erlaubt?`,
    toastSavegameReadFailed: "Ordner konnte nicht gelesen werden",
    toastSavegameNoFile: (d) => `${d} enthält noch keine workflowManager.xml — Speichern legt sie an`,
    toastNotSavegame: (d) => `${d} ist weder ein Spielstand-Ordner (keine careerSavegame.xml) noch der Ordner FarmingSimulator2025`,
    toastNoSavegames: (d) => `Noch keine Spielstände in ${d}`,
    toastCpFound: "Courseplays Ordner „Courses“ gefunden und verknüpft",
    sgTitle: "Welchen Spielstand öffnen?",
    sgScope: (d) => `In ${d}, zuletzt gespeicherte zuerst`,
    sgNameSlot: (n, slot) => `${n}, ${slot}`,
    sgOpenNow: "Gerade offen", sgHasWorkflows: "Mit Workflows",
    tgAdNeedMissing: (d) => `Keine AutoDrive_config.xml in ${d}, aber deine Workflows nutzen AutoDrive. AutoDrive schreibt sie beim Speichern des Spiels — importiere eine von Hand oder tippe Ziele unten ein.`,
    tgAdNeedFailed: "AutoDrive_config.xml konnte nicht gelesen werden. Importiere sie von Hand oder tippe Ziele unten ein.",
    tgCpNeedUnlinked: "Kurse liegen außerhalb des Spielstands und wurden deshalb nicht gefunden. Verknüpfe einmalig …/FarmingSimulator2025/\u200BmodSettings/\u200BFS25_Courseplay/\u200BCourses — oder öffne statt eines Spielstands den Ordner FarmingSimulator2025, dann wird er von selbst gefunden.",
    tgCpNeedPermission: "Der Browser braucht erneut deine Erlaubnis, den verknüpften Ordner „Courses“ zu lesen.",
    tgCpNeedOtherMap: (linked, m) => `Der verknüpfte Ordner enthält nur die Karte ${linked}, dieser Spielstand spielt ${m}. Verknüpfe den Ordner „Courses“ selbst, um alle Karten abzudecken.`,
    tgCpNeedFailed: "Der verknüpfte Ordner „Courses“ konnte nicht gelesen werden — vielleicht wurde er verschoben. Verknüpfe ihn erneut.",
    allowAccess: "Zugriff erlauben",
    reloadBtn: "Neu laden",
    reloadTitle: (d) => `workflowManager.xml, AutoDrive-Ziele und Courseplay-Kurse erneut aus ${d} lesen — z. B. nach Änderungen im Spiel.`,
    confirmReloadDiscard: (d) => `Aus ${d} neu laden? Änderungen, die hier gemacht und nicht nach ${d} gespeichert wurden, gehen verloren.`,
    toastAdScanned: (n) => `${n} AutoDrive-Ziel(e) aus AutoDrive_config.xml gelesen`,
    toastCpScanned: (n, m) => `${n} Courseplay-Kurs(e) für Karte ${m} gefunden`,
    toastCpLinked: "Courseplay-Ordner verknüpft",
    toastNotCoursesFolder: (d) => `${d} ist weder der Courseplay-Ordner „Courses“ (…/modSettings/FS25_Courseplay/Courses) noch ein Karten-Ordner darin`,
  },
};

/* ============================================================
   FS25 base-game fill types (name = internal ID stored in XML)
   ============================================================ */

// Sowable base-game FRUIT type names (not fill type names — GRASS's fill type is
// GRASS_WINDROW, but the seed is stored as the fruit type "GRASS"). In-game the list comes
// from g_fruitTypeManager, so a modded fruit can be missing here; an imported value that is
// not in this list is kept and shown as an extra option rather than being dropped.
const SEED_TYPES = [
  ["WHEAT", "Wheat", "Weizen"], ["BARLEY", "Barley", "Gerste"], ["OAT", "Oat", "Hafer"],
  ["CANOLA", "Canola", "Raps"], ["SORGHUM", "Sorghum", "Hirse"], ["MAIZE", "Corn", "Mais"],
  ["SUNFLOWER", "Sunflower", "Sonnenblumen"], ["SOYBEAN", "Soybeans", "Sojabohnen"],
  ["POTATO", "Potatoes", "Kartoffeln"], ["SUGARBEET", "Sugar Beet", "Zuckerrüben"],
  ["COTTON", "Cotton", "Baumwolle"], ["SUGARCANE", "Sugarcane", "Zuckerrohr"],
  ["GRAPE", "Grapes", "Trauben"], ["OLIVE", "Olives", "Oliven"], ["POPLAR", "Poplar", "Pappel"],
  ["GRASS", "Grass", "Gras"], ["OILSEEDRADISH", "Oilseed Radish", "Ölrettich"],
  ["PEA", "Peas", "Erbsen"], ["SPINACH", "Spinach", "Spinat"], ["GREENBEAN", "Green Beans", "Grüne Bohnen"],
  ["CARROT", "Carrots", "Karotten"], ["PARSNIP", "Parsnips", "Pastinaken"], ["BEETROOT", "Red Beet", "Rote Bete"],
  ["RICE", "Rice", "Reis"], ["RICELONGGRAIN", "Long Grain Rice", "Langkornreis"],
];

const FILL_TYPES = [
  ["WHEAT", "Wheat", "Weizen"], ["BARLEY", "Barley", "Gerste"], ["OAT", "Oat", "Hafer"],
  ["CANOLA", "Canola", "Raps"], ["SORGHUM", "Sorghum", "Hirse"], ["MAIZE", "Corn", "Mais"],
  ["SUNFLOWER", "Sunflower", "Sonnenblumen"], ["SOYBEAN", "Soybeans", "Sojabohnen"],
  ["POTATO", "Potatoes", "Kartoffeln"], ["SUGARBEET", "Sugar Beet", "Zuckerrüben"],
  ["SUGARBEET_CUT", "Sugar Beet Cuts", "Zuckerrübenschnitzel"], ["COTTON", "Cotton", "Baumwolle"],
  ["SUGARCANE", "Sugarcane", "Zuckerrohr"], ["GRAPE", "Grapes", "Trauben"], ["OLIVE", "Olives", "Oliven"],
  ["PEA", "Peas", "Erbsen"], ["SPINACH", "Spinach", "Spinat"], ["GREENBEAN", "Green Beans", "Grüne Bohnen"],
  ["RICE", "Rice", "Reis"], ["RICELONGGRAIN", "Long Grain Rice", "Langkornreis"],
  ["CARROT", "Carrots", "Karotten"], ["PARSNIP", "Parsnips", "Pastinaken"], ["BEETROOT", "Red Beet", "Rote Bete"],
  ["GRASS_WINDROW", "Grass", "Gras"], ["DRYGRASS_WINDROW", "Hay", "Heu"], ["STRAW", "Straw", "Stroh"],
  ["SILAGE", "Silage", "Silage"], ["CHAFF", "Chaff", "Häckselgut"], ["FORAGE", "Forage", "Futter"],
  ["FORAGE_MIXING", "Forage Mix", "Mischfutter"], ["WOODCHIPS", "Wood Chips", "Hackschnitzel"],
  ["MANURE", "Manure", "Mist"], ["LIQUIDMANURE", "Liquid Manure", "Gülle"], ["DIGESTATE", "Digestate", "Gärreste"],
  ["FERTILIZER", "Fertilizer", "Dünger"], ["LIQUIDFERTILIZER", "Liquid Fertilizer", "Flüssigdünger"],
  ["HERBICIDE", "Herbicide", "Herbizid"], ["LIME", "Lime", "Kalk"], ["SEEDS", "Seeds", "Saatgut"],
  ["ROADSALT", "Road Salt", "Streusalz"], ["SNOW", "Snow", "Schnee"], ["WATER", "Water", "Wasser"],
  ["DIESEL", "Diesel", "Diesel"], ["DEF", "DEF (AdBlue)", "AdBlue"], ["METHANE", "Methane", "Methan"],
  ["SILAGE_ADDITIVE", "Silage Additive", "Siliermittel"], ["MINERAL_FEED", "Mineral Feed", "Mineralfutter"],
  ["PIGFOOD", "Pig Food", "Schweinefutter"], ["STONE", "Stones", "Steine"],
  ["MILK", "Milk", "Milch"], ["BUFFALOMILK", "Buffalo Milk", "Büffelmilch"], ["GOATMILK", "Goat Milk", "Ziegenmilch"],
  ["EGG", "Eggs", "Eier"], ["WOOL", "Wool", "Wolle"], ["HONEY", "Honey", "Honig"],
  ["FLOUR", "Flour", "Mehl"], ["BREAD", "Bread", "Brot"], ["CAKE", "Cake", "Kuchen"],
  ["BUTTER", "Butter", "Butter"], ["CHEESE", "Cheese", "Käse"], ["FABRIC", "Fabric", "Stoff"],
  ["CLOTHES", "Clothes", "Kleidung"], ["SUNFLOWER_OIL", "Sunflower Oil", "Sonnenblumenöl"],
  ["CANOLA_OIL", "Canola Oil", "Rapsöl"], ["OLIVE_OIL", "Olive Oil", "Olivenöl"],
  ["GRAPEJUICE", "Grape Juice", "Traubensaft"], ["RAISINS", "Raisins", "Rosinen"],
  ["CHOCOLATE", "Chocolate", "Schokolade"], ["SUGAR", "Sugar", "Zucker"],
  ["LETTUCE", "Lettuce", "Salat"], ["TOMATO", "Tomatoes", "Tomaten"], ["STRAWBERRY", "Strawberries", "Erdbeeren"],
  ["BOARDS", "Boards", "Bretter"], ["WOODBEAM", "Wood Beams", "Holzbalken"], ["PLANKS", "Planks", "Bohlen"],
  ["FURNITURE", "Furniture", "Möbel"], ["PREFABWALL", "Prefab Walls", "Fertigwände"],
];

/* ============================================================
   State + persistence
   ============================================================ */

const LS_KEY = "fs25wm.webeditor.v1";

// Mod options and the HUD position are stored per player in the game's
// modSettings/FS25_WorkflowManager.xml, no longer in workflowManager.xml (mirrors WMStorage).
const state = {
  workflows: [],
  selectedId: null,
  // Target suggestions per savegame folder name ("" = no savegame open): every savegame has its
  // own AutoDrive network and map. `targets` is the active savegame's entry (see useLibrary).
  libraries: { "": { ad: [], cp: [] } },
  targets: null,
  customFillTypes: [],       // [{name, title}]
  lang: (navigator.language || "en").toLowerCase().startsWith("de") ? "de" : "en",
  theme: null,               // null = follow system
};

function saveState() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      workflows: state.workflows, selectedId: state.selectedId,
      libraries: state.libraries, customFillTypes: state.customFillTypes,
      lang: state.lang, theme: state.theme,
    }));
  } catch (e) { /* storage full/blocked — editing still works in-memory */ }
}

/** Makes the target lists of savegame folder `key` the active ones. */
function useLibrary(key) {
  if (!state.libraries[key]) state.libraries[key] = { ad: [], cp: [] };
  state.targets = state.libraries[key];
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.workflows)) state.workflows = data.workflows;
    state.selectedId = data.selectedId || null;
    if (data.libraries && typeof data.libraries === "object") {
      for (const [key, lib] of Object.entries(data.libraries)) {
        state.libraries[key] = { ad: lib.ad || [], cp: lib.cp || [] };
      }
    } else if (data.targets) {
      // One shared list before per-savegame lists — it can't be told apart, so it stays the
      // "no savegame" list instead of leaking another map's names into every savegame.
      state.libraries[""] = { ad: data.targets.ad || [], cp: data.targets.cp || [] };
    }
    if (Array.isArray(data.customFillTypes)) state.customFillTypes = data.customFillTypes;
    if (data.lang === "en" || data.lang === "de") state.lang = data.lang;
    if (data.theme === "light" || data.theme === "dark") state.theme = data.theme;
    // A selectedId that no longer resolves leaves the editor showing the empty hero next to a
    // full sidebar — fall back to the first workflow instead.
    if (state.selectedId && !state.workflows.some((w) => w.id === state.selectedId)) {
      state.selectedId = state.workflows[0]?.id || null;
    }
  } catch (e) { /* corrupted storage — start fresh */ }
  finally { useLibrary(""); } // the savegame's lists follow once restoreLink() finds the link
}

const t = (key, ...args) => {
  const v = I18N[state.lang][key] ?? I18N.en[key] ?? key;
  return typeof v === "function" ? v(...args) : v;
};

function commit() { saveState(); render(); }

/* ============================================================
   Model helpers
   ============================================================ */

/** Same shape as WorkflowManager:generateWorkflowId() (workflow_<time>_<rand>).
 *  Pass a Set of ids already in use — the timestamp part is identical for ids minted in the
 *  same millisecond (duplicate/import loops), leaving only 9000 random values to collide over. */
function generateWorkflowId(taken) {
  let id;
  do { id = `workflow_${Date.now()}_${1000 + Math.floor(Math.random() * 9000)}`; }
  while (taken && taken.has(id));
  return id;
}

function usedWorkflowIds() {
  return new Set(state.workflows.map((w) => w.id));
}

function newWorkflow(name) {
  return { id: generateWorkflowId(usedWorkflowIds()), name: name || t("newWfName"), adSettings: {}, steps: [] };
}

function selectedWorkflow() {
  return state.workflows.find((w) => w.id === state.selectedId) || null;
}

function stepTypeLabel(type) {
  switch (type) {
    case STEP_AUTODRIVE: return t("typeAd");
    case STEP_COURSEPLAY: return t("typeCp");
    case STEP_WAIT_FOR_LEADER: return t("typeWait");
    case STEP_UNLOCK_FOLLOWER: return t("typeUnlock");
    case STEP_PARK: return t("typePark");
    case STEP_REFUEL: return t("typeRefuel");
    case STEP_REPAIR: return t("typeRepair");
    default: return type;
  }
}

/** Info text shown in the step dialog for targetless types (null for AD/CP). */
function stepInfoKey(type) {
  switch (type) {
    case STEP_WAIT_FOR_LEADER: return "markerWaitInfo";
    case STEP_UNLOCK_FOLLOWER: return "markerUnlockInfo";
    case STEP_PARK: return "parkInfo";
    case STEP_REFUEL: return "refuelInfo";
    case STEP_REPAIR: return "repairInfo";
    default: return null;
  }
}

function actionLabel(action) {
  return I18N[state.lang].actionNames[action] || I18N.en.actionNames[action] || action || "";
}

function allFillTypes() {
  const base = FILL_TYPES.map(([name, en, de]) => ({ name, title: state.lang === "de" ? de : en }));
  const extra = state.customFillTypes.filter((c) => !base.some((b) => b.name === c.name));
  return base.concat(extra).sort((a, b) => a.title.localeCompare(b.title, state.lang));
}

function fillTypeTitle(name) {
  const ft = allFillTypes().find((f) => f.name === name);
  return ft ? ft.title : name;
}

function rememberTarget(kind, name) {
  if (!name) return;
  const list = state.targets[kind];
  if (!list.includes(name)) { list.push(name); list.sort((a, b) => a.localeCompare(b)); }
}

/** Collect target names used by a step into the suggestion library. */
function harvestStepTargets(step) {
  if (isMarkerType(step.type)) return;
  const kind = step.type === STEP_COURSEPLAY ? "cp" : "ad";
  rememberTarget(kind, step.target);
  if (step.unloadTarget) rememberTarget("ad", step.unloadTarget);
  if (step.fillTypes) {
    for (const name of step.fillTypes) {
      if (!FILL_TYPES.some(([n]) => n === name) && !state.customFillTypes.some((c) => c.name === name)) {
        state.customFillTypes.push({ name, title: name });
      }
    }
  }
}

/* ============================================================
   XML import (mirrors WMStorage:loadWorkflows incl. migrations)
   ============================================================ */

function parseFillTypesAttr(str) {
  if (!str) return null;
  const arr = str.split(",").map((s) => s.trim()).filter(Boolean);
  return arr.length ? arr : null;
}

function attr(el, name, fallback = null) {
  return el.hasAttribute(name) ? el.getAttribute(name) : fallback;
}
function floatAttr(el, name) {
  if (!el || !el.hasAttribute(name)) return null;
  const v = parseFloat(el.getAttribute(name));
  return Number.isFinite(v) ? v : null;
}
function boolAttr(el, name, fallback) {
  if (!el.hasAttribute(name)) return fallback;
  return el.getAttribute(name) !== "false";
}

function parseStepEl(el, withSupport) {
  const step = {
    type: attr(el, "type", STEP_AUTODRIVE),
    target: attr(el, "target", ""),
    action: attr(el, "action", "default"),
    unloadTarget: attr(el, "unloadTarget") || null,
    fillTypes: parseFillTypesAttr(attr(el, "fillTypes")) || parseFillTypesAttr(attr(el, "fillType")),
    seedFruitType: attr(el, "seedFruitType") || null,
    // Legacy fields read for migration only.
    // No default for the sync flags: absent vs false must stay distinguishable — the flag
    // era only wrote them when false, pre-sync-era files never wrote them at all.
    syncGroup: el.hasAttribute("syncGroup") ? parseInt(el.getAttribute("syncGroup"), 10) : null,
    isSyncTarget: boolAttr(el, "isSyncTarget", null),
    isSyncSource: boolAttr(el, "isSyncSource", null),
  };
  if (withSupport) {
    step.support = [...el.children]
      .filter((c) => c.tagName === "support")
      .map((c) => parseStepEl(c, false));
  } else if (boolAttr(el, "finishBeforeSwitch", false)) {
    // Support sub-steps only: finish before following the main vehicle to its next step
    step.finishBeforeSwitch = true;
  }
  return step;
}

/** Old linked-workflow-pair format -> hierarchical support format (port of Lua migration). */
function migrateOldLinkedWorkflows(workflows) {
  if (!workflows.some((wf) => wf.linkRole != null)) return { workflows, migrated: false };

  const byId = new Map(workflows.map((wf) => [wf.id, wf]));
  const toRemove = new Set();

  for (const wf of workflows) {
    if (wf.linkRole === "main" && wf.linkedWorkflowId) {
      const supportWf = byId.get(wf.linkedWorkflowId);
      if (supportWf && supportWf.linkRole === "support" && supportWf.steps.length > 0) {
        const groupSteps = new Map();
        for (const step of supportWf.steps) {
          if (step.syncGroup != null) {
            if (!groupSteps.has(step.syncGroup)) groupSteps.set(step.syncGroup, []);
            groupSteps.get(step.syncGroup).push({
              type: step.type, target: step.target, action: step.action,
              unloadTarget: step.unloadTarget, fillTypes: step.fillTypes ? [...step.fillTypes] : null,
            });
          }
        }
        const lastIndexForGroup = new Map();
        wf.steps.forEach((step, i) => {
          if (step.syncGroup != null) lastIndexForGroup.set(step.syncGroup, i);
        });
        for (const [g, idx] of lastIndexForGroup) {
          if (groupSteps.has(g)) wf.steps[idx].support = groupSteps.get(g);
        }
        toRemove.add(supportWf.id);
      }
    }
  }

  const result = workflows.filter((wf) => !toRemove.has(wf.id));
  for (const wf of result) {
    delete wf.linkedWorkflowId;
    delete wf.linkRole;
    for (const step of wf.steps) {
      if (!step.support) step.support = [];
      step.syncGroup = null;
    }
  }
  return { workflows: result, migrated: toRemove.size > 0 };
}

/** Old per-step sync flags -> explicit wait/unlock marker steps (port of Lua migration). */
function migrateSyncFlagsToMarkers(workflows, formatVersion) {
  if (formatVersion >= 2) {
    for (const wf of workflows) for (const step of wf.steps) {
      delete step.isSyncTarget; delete step.isSyncSource;
    }
    return { workflows, migrated: false };
  }
  // Distinguish two generations of version-less (v1) files:
  //  * flag-era files wrote isSyncTarget/isSyncSource, but ONLY when false — within such
  //    a file, an absent flag means true.
  //  * pre-sync-era files never wrote the flags at all — sync did not exist, so no markers
  //    must be inserted. Without this check every legacy workflow gets two markers before
  //    every step (a 6-step workflow balloons to 18).
  const hasAnySyncFlag = workflows.some((wf) =>
    wf.steps.some((step) => step.isSyncTarget != null || step.isSyncSource != null));
  if (!hasAnySyncFlag) {
    for (const wf of workflows) for (const step of wf.steps) {
      delete step.isSyncTarget; delete step.isSyncSource;
    }
    return { workflows, migrated: false };
  }

  let migrated = false;
  for (const wf of workflows) {
    const newSteps = [];
    for (const step of wf.steps) {
      if (step.isSyncSource !== false) {
        newSteps.push({ type: STEP_WAIT_FOR_LEADER, target: "", support: [] });
        migrated = true;
      }
      if (step.isSyncTarget !== false) {
        newSteps.push({ type: STEP_UNLOCK_FOLLOWER, target: "", support: [] });
        migrated = true;
      }
      delete step.isSyncTarget; delete step.isSyncSource;
      newSteps.push(step);
    }
    wf.steps = newSteps;
  }
  return { workflows, migrated };
}

function importWorkflowsXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const root = doc.querySelector("WorkflowManager");
  if (!root || doc.querySelector("parsererror")) return null;

  const formatVersion = parseInt(root.getAttribute("formatVersion") || "1", 10) || 1;

  let workflows = [...root.querySelectorAll(":scope > workflows > workflow")].map((wfEl) => {
    const adEl = wfEl.querySelector(":scope > adSettings");
    return {
      id: attr(wfEl, "id", generateWorkflowId()),
      name: attr(wfEl, "name", "Unnamed Workflow"),
      linkedWorkflowId: attr(wfEl, "linkedWorkflowId"),
      linkRole: attr(wfEl, "linkRole"),
      adSettings: {
        unloadFillLevel: floatAttr(adEl, "unloadFillLevel"),
        pipeOffset: floatAttr(adEl, "pipeOffset"),
        preCallLevel: floatAttr(adEl, "preCallLevel"),
      },
      steps: [...wfEl.children].filter((c) => c.tagName === "step").map((s) => parseStepEl(s, true)),
    };
  });

  let anyMigrated = false;
  ({ workflows, migrated: anyMigrated } = migrateOldLinkedWorkflows(workflows));
  const m2 = migrateSyncFlagsToMarkers(workflows, formatVersion);
  workflows = m2.workflows;
  anyMigrated = anyMigrated || m2.migrated;

  // Normalize: drop migration-only fields, ensure arrays
  for (const wf of workflows) {
    for (const step of wf.steps) {
      delete step.syncGroup;
      if (!step.support) step.support = [];
      for (const sub of step.support) { delete sub.syncGroup; delete sub.isSyncTarget; delete sub.isSyncSource; }
    }
  }

  // Both this editor and the game key workflows by id (WorkflowManager:getWorkflowById), so a
  // hand-edited or concatenated file with a repeated id would make one of them unreachable.
  const seenIds = new Set();
  for (const wf of workflows) {
    if (!wf.id || seenIds.has(wf.id)) wf.id = generateWorkflowId(seenIds);
    seenIds.add(wf.id);
  }

  // A <settings> block from older files is ignored: the game keeps its options and the HUD
  // position per player now and only adopts that block once from an old savegame.
  return { workflows, migrated: anyMigrated };
}

/* ============================================================
   XML export (mirrors WMStorage:saveWorkflows, formatVersion 2)
   ============================================================ */

function xmlEscape(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
}

function fmtFloat(v) {
  // Trim trailing zeros but keep game-compatible decimal notation
  return String(Math.round(v * 1e6) / 1e6);
}

function stepAttrs(step) {
  let s = ` type="${xmlEscape(step.type)}"`;
  if (!isMarkerType(step.type)) {
    s += ` target="${xmlEscape(step.target || "")}"`;
    s += ` action="${xmlEscape(step.action || "default")}"`;
  }
  if (step.unloadTarget) s += ` unloadTarget="${xmlEscape(step.unloadTarget)}"`;
  if (step.fillTypes && step.fillTypes.length) s += ` fillTypes="${xmlEscape(step.fillTypes.join(","))}"`;
  if (step.seedFruitType) s += ` seedFruitType="${xmlEscape(step.seedFruitType)}"`;
  if (step.finishBeforeSwitch) s += ` finishBeforeSwitch="true"`;
  return s;
}

function exportWorkflowsXml() {
  const lines = [];
  lines.push('<?xml version="1.0" encoding="utf-8" standalone="no"?>');
  lines.push('<WorkflowManager formatVersion="2">');
  lines.push("    <workflows>");
  for (const wf of state.workflows) {
    lines.push(`        <workflow id="${xmlEscape(wf.id)}" name="${xmlEscape(wf.name || "Unnamed Workflow")}">`);
    const s = wf.adSettings || {};
    if (s.unloadFillLevel != null || s.pipeOffset != null || s.preCallLevel != null) {
      let a = "";
      if (s.unloadFillLevel != null) a += ` unloadFillLevel="${fmtFloat(s.unloadFillLevel)}"`;
      if (s.pipeOffset != null) a += ` pipeOffset="${fmtFloat(s.pipeOffset)}"`;
      if (s.preCallLevel != null) a += ` preCallLevel="${fmtFloat(s.preCallLevel)}"`;
      lines.push(`            <adSettings${a}/>`);
    }
    for (const step of wf.steps) {
      const support = step.support || [];
      if (support.length === 0) {
        lines.push(`            <step${stepAttrs(step)}/>`);
      } else {
        lines.push(`            <step${stepAttrs(step)}>`);
        for (const sub of support) lines.push(`                <support${stepAttrs(sub)}/>`);
        lines.push("            </step>");
      }
    }
    lines.push("        </workflow>");
  }
  lines.push("    </workflows>");
  lines.push("</WorkflowManager>");
  lines.push("");
  return lines.join("\n");
}

/* ============================================================
   AutoDrive config / CP course file import (target suggestions)
   ============================================================ */

/** Destination names as the game's step dialog stores them: "group/name", or the bare name for
 *  AutoDrive's default group "All" (mirrors ADIntegration:getDestinations). Null when the file
 *  holds no map markers. */
function adMarkerNames(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  if (doc.querySelector("parsererror")) return null;
  const names = new Set();
  // AutoDrive config: <mapmarker><mm1><name>Feld 9</name><group>Felder 01-20</group>…
  for (const mm of doc.querySelectorAll("mapmarker > *")) {
    const name = (mm.querySelector("name")?.textContent || "").trim();
    const group = (mm.querySelector("group")?.textContent || "").trim();
    if (name) names.add(group && group !== "All" ? `${group}/${name}` : name);
  }
  // Fallback: <marker name="..."> style
  if (names.size === 0) {
    for (const m of doc.querySelectorAll("marker[name]")) {
      const name = m.getAttribute("name").trim();
      if (name) names.add(name);
    }
  }
  return names.size ? [...names] : null;
}

function importAdConfigXml(xmlText) {
  const names = adMarkerNames(xmlText);
  if (!names) return -1;
  let added = 0;
  for (const name of names) {
    if (!state.targets.ad.includes(name)) { state.targets.ad.push(name); added++; }
  }
  state.targets.ad.sort((a, b) => a.localeCompare(b));
  return added;
}

/** Courseplay course files have no extension ("…/F01/Kalken"), so a folder pick is filtered by
 *  content: a course file is XML with a <Courses> root. Reads only the first bytes. */
async function isCourseFile(file) {
  return (await file.slice(0, 512).text()).includes("<Courses");
}

/** Root-relative course name for a picked file ("Singleplayer/F34/Kalken").
 *  Courseplay stores and resolves course names relative to its root directory view, and the
 *  in-game lookup (CPIntegration:findCourseEntry) matches the folder part as a path SUFFIX.
 *  A bare base name therefore matches every field folder holding a course of that name and
 *  silently loads the wrong field's course — so the folders the file sits in are part of the
 *  name, not decoration. Courseplay's root always contains a "Singleplayer" folder
 *  (fixCourseStorageRoot hardcodes it, multiplayer included); keep the path from there on so
 *  the result is identical no matter which level the user picked. */
function courseNameFromFile(file) {
  const rel = String(file.webkitRelativePath || file.name).replace(/\\/g, "/");
  const parts = rel.split("/").filter(Boolean);
  const rootIndex = parts.indexOf("Singleplayer");
  return (rootIndex >= 0 ? parts.slice(rootIndex) : parts).join("/").trim();
}

async function importCpCourseFiles(files) {
  let added = 0;
  for (const f of files) {
    if (!(await isCourseFile(f))) continue; // a folder pick hands us everything inside it
    const name = courseNameFromFile(f);
    if (name && !state.targets.cp.includes(name)) { state.targets.cp.push(name); added++; }
  }
  state.targets.cp.sort((a, b) => a.localeCompare(b));
  return added;
}

/* ============================================================
   DOM helpers
   ============================================================ */

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
}

const ICONS = {
  grip: '<svg viewBox="0 0 10 18"><circle cx="2.5" cy="3" r="1.6" fill="currentColor"/><circle cx="7.5" cy="3" r="1.6" fill="currentColor"/><circle cx="2.5" cy="9" r="1.6" fill="currentColor"/><circle cx="7.5" cy="9" r="1.6" fill="currentColor"/><circle cx="2.5" cy="15" r="1.6" fill="currentColor"/><circle cx="7.5" cy="15" r="1.6" fill="currentColor"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="m6 14 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="m6 10 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  plusSub: '<svg viewBox="0 0 24 24"><path d="M8 5v10a2 2 0 0 0 2 2h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M17 14v6m-3-3h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

function miniBtn(icon, title, onClick, opts = {}) {
  const b = el("button", { class: `mini ${opts.class || ""}`, title, html: ICONS[icon] });
  if (opts.disabled) b.disabled = true;
  b.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
  return b;
}

function toast(msg, isError = false) {
  const node = el("div", { class: `toast${isError ? " error" : ""}` }, msg);
  $("toastWrap").append(node);
  setTimeout(() => { node.style.opacity = "0"; node.style.transition = "opacity .3s"; }, 3200);
  setTimeout(() => node.remove(), 3600);
}

let confirmCallback = null;
/** @param okKey i18n key for the confirming button — it is not always a deletion. */
function askConfirm(text, onOk, okKey = "delete") {
  confirmCallback = onOk;
  $("confirmText").textContent = text;
  $("confirmOk").textContent = t(okKey);
  $("confirmModal").showModal();
}

/* ============================================================
   Rendering
   ============================================================ */

function applyI18nStatic() {
  document.documentElement.lang = state.lang;
  // Welcome text names the main button: open a savegame where the browser can, else export
  $("emptyText").dataset.i18nHtml = canLinkSavegame ? "emptyTextOpen" : "emptyText";
  $("emptyHint").dataset.i18n = canLinkSavegame ? "emptyHintFolder" : "emptyHint";
  $("dropText").dataset.i18n = canLinkSavegame ? "dropHereFolder" : "dropHere";
  for (const node of document.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
  }
  // Same, for the handful of strings that carry inline markup (constants from I18N above —
  // never user input). Plain [data-i18n] would flatten the <code> element on first render.
  for (const node of document.querySelectorAll("[data-i18n-html]")) {
    node.innerHTML = t(node.dataset.i18nHtml);
  }
  for (const node of document.querySelectorAll("[data-i18n-ph]")) {
    node.placeholder = t(node.dataset.i18nPh);
  }
  for (const node of document.querySelectorAll("[data-i18n-action]")) {
    node.textContent = actionLabel(node.dataset.i18nAction);
  }
  $("langLabel").textContent = t("langName");
  $("btnQuickWait").title = t("typeWait");
  $("btnQuickUnlock").title = t("typeUnlock");
  $("btnQuickPark").title = t("typePark");
  $("btnQuickRefuel").title = t("typeRefuel");
  $("btnQuickRepair").title = t("typeRepair");
  $("btnOpenSavegame").hidden = !canLinkSavegame;
  $("btnOpenSavegame").title = t("openSavegameTitle");
  $("btnEmptyOpenSavegame").hidden = !canLinkSavegame;
  $("btnEmptyOpenSavegame").title = t("openSavegameTitle");
  $("btnEmptyNew").classList.toggle("primary", !canLinkSavegame);
  $("btnEmptyNew").classList.toggle("ghost", canLinkSavegame);
  $("btnReload").hidden = !link.dir;
  $("btnReload").title = link.dir ? t("reloadTitle", link.dir.name) : "";
  $("exportLabel").textContent = link.dir ? t("saveToBtn", link.dir.name) : t("exportBtn");
  $("btnExport").title = link.dir ? t("saveToTitle", link.dir.name) : "";
}

function applyTheme() {
  if (state.theme) document.documentElement.dataset.theme = state.theme;
  else {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }
  const isDark = document.documentElement.dataset.theme === "dark";
  $("iconSun").hidden = isDark;
  $("iconMoon").hidden = !isDark;
}

function render() {
  applyI18nStatic();
  renderSidebar();
  renderEditor();
}

function renderSidebar() {
  const list = $("wfList");
  const q = $("wfSearch").value.trim().toLowerCase();
  list.replaceChildren();

  const filtered = state.workflows.filter((w) => !q || (w.name || "").toLowerCase().includes(q));
  if (filtered.length === 0) {
    list.append(el("div", { class: "wf-list-empty" }, t("noEntries")));
  }
  for (const wf of filtered) {
    const active = wf.id === state.selectedId;
    // The row is a plain element wrapping one selectable button — nesting the duplicate/delete
    // buttons inside a <button> row would be invalid HTML and unreachable for screen readers.
    const select = el("button", { type: "button", class: "wf-item-main", "aria-current": active ? "true" : null },
      el("span", { class: "wf-item-name" }, wf.name || t("unnamed")),
      el("span", { class: "wf-item-count", title: t("stepCount", wf.steps.length) },
        el("span", { "aria-hidden": "true" }, String(wf.steps.length)),
        el("span", { class: "sr" }, t("stepCount", wf.steps.length))));
    select.addEventListener("click", () => { state.selectedId = wf.id; commit(); });
    const item = el("div", { class: `wf-item${active ? " active" : ""}` },
      select,
      el("div", { class: "wf-item-actions" },
        miniBtn("copy", t("duplicate"), () => duplicateWorkflow(wf.id)),
        miniBtn("trash", t("delete"), () => requestDeleteWorkflow(wf.id), { class: "danger" })));
    list.append(item);
  }
  $("wfCount").textContent = t("wfCount", state.workflows.length);
}

function renderEditor() {
  const wf = selectedWorkflow();
  $("editorEmpty").hidden = !!wf;
  $("editorView").hidden = !wf;
  if (!wf) return;

  const nameInput = $("wfName");
  if (nameInput.value !== (wf.name || "")) nameInput.value = wf.name || "";

  const supportCount = wf.steps.reduce((n, s) => n + (s.support ? s.support.length : 0), 0);
  $("wfMeta").replaceChildren(
    el("span", {}, t("stepCount", wf.steps.length) + (supportCount ? `, ${t("supportStepCount", supportCount)}` : "")),
    el("span", { class: "wf-id" }, `${t("metaId")} ${wf.id}`),
  );

  // AD settings
  const s = wf.adSettings || {};
  setNumInput($("adUnloadFill"), s.unloadFillLevel != null ? Math.round(s.unloadFillLevel * 100) : null);
  setNumInput($("adPipeOffset"), s.pipeOffset);
  setNumInput($("adPreCall"), s.preCallLevel != null ? Math.round(s.preCallLevel * 100) : null);
  const nSet = [s.unloadFillLevel, s.pipeOffset, s.preCallLevel].filter((v) => v != null).length;
  $("adSettingsSummary").textContent = nSet ? t("settingsSet", nSet) : t("settingsNone");

  renderSteps(wf);
}

function setNumInput(input, value) {
  const str = value != null ? String(value) : "";
  if (input.value !== str && document.activeElement !== input) input.value = str;
}

function renderSteps(wf) {
  const list = $("stepList");
  list.replaceChildren();
  $("stepsEmpty").hidden = wf.steps.length > 0;

  wf.steps.forEach((step, i) => {
    const group = el("div", { class: "step-group" });
    group.append(stepRow(wf, step, i, null));
    (step.support || []).forEach((sub, j) => group.append(stepRow(wf, sub, i, j)));
    list.append(group);
  });
}

function typeBadgeClass(type) {
  if (type === STEP_AUTODRIVE) return "ad";
  if (type === STEP_COURSEPLAY) return "cp";
  // Park/Refuel/Repair are targetless but still real AutoDrive jobs — only the leader/follower
  // sync markers are pass-throughs, so they don't share the marker colour.
  return isSyncMarkerType(type) ? "marker" : "auto";
}

function stepRow(wf, step, stepIndex, supportIndex) {
  const isSupport = supportIndex != null;
  const marker = isMarkerType(step.type);
  const missingTarget = !marker && !(step.target || "").trim();
  // Sync markers pair against workflow.steps only (WMExecutor:buildSyncMaps), so one nested
  // under a main step can never be satisfied. New ones can't be created (see modalStepTypes),
  // but imported files from before that restriction can still carry them.
  const strandedMarker = isSupport && isSyncMarkerType(step.type);

  // One stop on the route: the node's colour is the system (the step dialog's job groups),
  // sync markers on the main line are drawn as gates across it instead of stops.
  const sys = typeBadgeClass(step.type);
  const gate = !isSupport && isSyncMarkerType(step.type);
  const row = el("div", {
    class: `step-row sys-${sys}${isSupport ? " support-row" : ""}${gate ? " gate" : ""}${missingTarget || strandedMarker ? " invalid" : ""}`,
    draggable: "true",
  });
  row.dataset.step = stepIndex;
  if (isSupport) row.dataset.support = supportIndex;

  // drag handle
  row.append(el("span", { class: "drag", html: ICONS.grip, title: "" }));
  row.append(el("span", { class: "step-num" }, isSupport ? `${stepIndex + 1}.${supportIndex + 1}` : `${stepIndex + 1}`));
  row.append(el("span", { class: "node", "aria-hidden": "true" }));

  // The whole summary opens the step dialog — one big target instead of a pencil icon
  const main = el("button", { type: "button", class: "step-open", title: t("edit") },
    el("span", { class: "sr" }, `${stepTypeLabel(step.type)}: `),
    el("span", { class: "step-job" }, marker ? stepTypeLabel(step.type) : actionLabel(step.action)));

  if (strandedMarker) {
    main.append(el("span", { class: "step-where missing" }, `⚠ ${t("validationMarkerInSupport")}`));
  }

  if (!marker) {
    const where = el("span", { class: "step-where" });
    if (missingTarget) {
      where.classList.add("missing");
      where.append(`⚠ ${t("validationMissingTarget")}`);
    } else {
      // Stops in driving order, as the step dialog lists them: Load visits its second
      // destination ("Load At") first and then returns to the target.
      const stops = [step.target];
      if (step.unloadTarget) {
        if (step.action === "load") stops.unshift(step.unloadTarget);
        else stops.push(step.unloadTarget);
      }
      const kind = step.type === STEP_COURSEPLAY ? "cp" : "ad";
      stops.forEach((name, i) => {
        if (i > 0) where.append(el("span", { class: "arrow", "aria-hidden": "true" }, "→"));
        const { group, leaf } = targetGroup(kind, name);
        where.append(el("span", { class: "tgt", title: name },
          group ? el("span", { class: "grp" }, `${group}/`) : null, leaf));
      });
    }
    main.append(where);
    const chips = [...(step.fillTypes || []).map(fillTypeTitle)];
    if (step.seedFruitType) chips.push(seedTypeLabel(step.seedFruitType));
    if (chips.length) {
      main.append(el("span", { class: "fill-chips" }, ...chips.map((c) => el("span", { class: "fill-chip" }, c))));
    }
  }
  main.addEventListener("click", () => openStepModal(wf, { stepIndex, supportIndex }));
  row.append(main);

  const siblings = isSupport ? wf.steps[stepIndex].support : wf.steps;
  const idx = isSupport ? supportIndex : stepIndex;
  const actions = el("div", { class: "step-actions" });
  if (!isSupport) {
    actions.append(miniBtn("plusSub", t("addSupport"), () => openStepModal(wf, { stepIndex, supportIndex: null, isNewSupport: true }), { class: "support-add" }));
  }
  actions.append(
    miniBtn("up", t("moveUp"), () => moveStep(wf, stepIndex, supportIndex, -1), { disabled: idx === 0 }),
    miniBtn("down", t("moveDown"), () => moveStep(wf, stepIndex, supportIndex, +1), { disabled: idx === siblings.length - 1 }),
    miniBtn("copy", t("duplicate"), () => duplicateStep(wf, stepIndex, supportIndex)),
    miniBtn("trash", t("delete"), () => requestDeleteStep(wf, stepIndex, supportIndex), { class: "danger" }),
  );
  row.append(actions);

  wireStepDrag(row, wf, stepIndex, supportIndex);
  return row;
}

/* ---------- step mutations ---------- */

function moveStep(wf, stepIndex, supportIndex, delta) {
  const list = supportIndex != null ? wf.steps[stepIndex].support : wf.steps;
  const i = supportIndex != null ? supportIndex : stepIndex;
  const j = i + delta;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  commit();
}

function duplicateStep(wf, stepIndex, supportIndex) {
  if (supportIndex != null) {
    const sub = wf.steps[stepIndex].support[supportIndex];
    wf.steps[stepIndex].support.splice(supportIndex + 1, 0, structuredClone(sub));
  } else {
    wf.steps.splice(stepIndex + 1, 0, structuredClone(wf.steps[stepIndex]));
  }
  commit();
}

function requestDeleteStep(wf, stepIndex, supportIndex) {
  const hasSupport = supportIndex == null && (wf.steps[stepIndex].support || []).length > 0;
  const doDelete = () => {
    if (supportIndex != null) wf.steps[stepIndex].support.splice(supportIndex, 1);
    else wf.steps.splice(stepIndex, 1);
    commit();
  };
  if (supportIndex != null || hasSupport) {
    askConfirm(supportIndex != null ? t("confirmDeleteSupport") : t("confirmDeleteStep"), doDelete);
  } else {
    doDelete();
  }
}

function addMarkerStep(wf, type) {
  wf.steps.push({ type, target: "", support: [] });
  commit();
}

/* ---------- drag & drop (reorder within same level) ---------- */

let dragInfo = null;

function wireStepDrag(row, wf, stepIndex, supportIndex) {
  row.addEventListener("dragstart", (e) => {
    dragInfo = { stepIndex, supportIndex };
    row.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "");
  });
  row.addEventListener("dragend", () => {
    row.classList.remove("dragging");
    dragInfo = null;
    document.querySelectorAll(".drop-above,.drop-below").forEach((n) => n.classList.remove("drop-above", "drop-below"));
  });
  row.addEventListener("dragover", (e) => {
    if (!dragInfo) return;
    const sameLevel = (dragInfo.supportIndex == null) === (supportIndex == null)
      && (dragInfo.supportIndex == null || dragInfo.stepIndex === stepIndex);
    if (!sameLevel) return;
    e.preventDefault();
    const rect = row.getBoundingClientRect();
    const below = e.clientY > rect.top + rect.height / 2;
    row.classList.toggle("drop-above", !below);
    row.classList.toggle("drop-below", below);
  });
  row.addEventListener("dragleave", () => row.classList.remove("drop-above", "drop-below"));
  row.addEventListener("drop", (e) => {
    if (!dragInfo) return;
    e.preventDefault();
    const rect = row.getBoundingClientRect();
    const below = e.clientY > rect.top + rect.height / 2;
    if (supportIndex == null && dragInfo.supportIndex == null) {
      let to = stepIndex + (below ? 1 : 0);
      const [moved] = wf.steps.splice(dragInfo.stepIndex, 1);
      if (dragInfo.stepIndex < to) to--;
      wf.steps.splice(to, 0, moved);
    } else if (supportIndex != null && dragInfo.supportIndex != null && dragInfo.stepIndex === stepIndex) {
      const list = wf.steps[stepIndex].support;
      let to = supportIndex + (below ? 1 : 0);
      const [moved] = list.splice(dragInfo.supportIndex, 1);
      if (dragInfo.supportIndex < to) to--;
      list.splice(to, 0, moved);
    } else {
      return;
    }
    dragInfo = null;
    commit();
  });
}

/* ============================================================
   Workflow list actions
   ============================================================ */

function createWorkflow() {
  const wf = newWorkflow();
  state.workflows.push(wf);
  state.selectedId = wf.id;
  commit();
  $("wfName").focus();
  $("wfName").select();
}

function duplicateWorkflow(id) {
  const src = state.workflows.find((w) => w.id === id);
  if (!src) return;
  const copy = structuredClone(src);
  copy.id = generateWorkflowId(usedWorkflowIds());
  copy.name = `${src.name || t("unnamed")} ${t("copySuffix")}`;
  const idx = state.workflows.indexOf(src);
  state.workflows.splice(idx + 1, 0, copy);
  state.selectedId = copy.id;
  commit();
}

function requestDeleteWorkflow(id) {
  const wf = state.workflows.find((w) => w.id === id);
  if (!wf) return;
  askConfirm(t("confirmDeleteWf", wf.name || t("unnamed"), wf.steps.length), () => {
    const idx = state.workflows.indexOf(wf);
    state.workflows.splice(idx, 1);
    if (state.selectedId === id) {
      state.selectedId = state.workflows[Math.min(idx, state.workflows.length - 1)]?.id || null;
    }
    commit();
  });
}

/* ============================================================
   Step modal
   ============================================================ */

const modal = {
  wf: null,
  stepIndex: null,     // main step index (edit main / context for support)
  supportIndex: null,  // support index when editing a support step
  isNewSupport: false,
  isNew: false,
  type: STEP_AUTODRIVE,
  action: "drive",
  fillTypes: [],
  seedFruitType: "",
  finishBeforeSwitch: false,
};

/** Every existing step of `wf` in step-list order: 1, 1.1, 1.2, 2, … */
function stepRefs(wf) {
  const refs = [];
  wf.steps.forEach((s, i) => {
    refs.push({ stepIndex: i, supportIndex: null });
    (s.support || []).forEach((_, j) => refs.push({ stepIndex: i, supportIndex: j }));
  });
  return refs;
}

const stepRefLabel = (ref) => ref.supportIndex != null ? `${ref.stepIndex + 1}.${ref.supportIndex + 1}` : `${ref.stepIndex + 1}`;

function openStepModal(wf, { stepIndex = null, supportIndex = null, isNewSupport = false, focusField = true } = {}) {
  modal.wf = wf;
  modal.stepIndex = stepIndex;
  modal.supportIndex = supportIndex;
  modal.isNewSupport = isNewSupport;
  modal.isNew = isNewSupport || stepIndex == null;

  let existing = null;
  if (!modal.isNew) {
    existing = supportIndex != null ? wf.steps[stepIndex].support[supportIndex] : wf.steps[stepIndex];
  }

  modal.type = existing?.type || STEP_AUTODRIVE;
  modal.action = existing?.action && existing.action !== "default"
    ? existing.action
    : (modal.type === STEP_COURSEPLAY ? "fieldwork" : "drive");
  modal.fillTypes = existing?.fillTypes ? [...existing.fillTypes] : [];
  modal.seedFruitType = existing?.seedFruitType || "";
  modal.finishBeforeSwitch = existing?.finishBeforeSwitch === true;
  $("stepTarget").value = existing?.target || "";
  $("stepUnloadTarget").value = existing?.unloadTarget || "";
  $("fillSearch").value = "";

  const titleKey = isNewSupport ? "dialogAddSupport"
    : supportIndex != null ? "dialogEditSupport"
    : modal.isNew ? "dialogAddStep" : "dialogEditStep";
  $("stepModalTitle").textContent = t(titleKey);
  // The number the step has (or will get) in the step list
  $("stepModalNum").textContent = isNewSupport ? `${stepIndex + 1}.${(wf.steps[stepIndex].support || []).length + 1}`
    : modal.isNew ? `${wf.steps.length + 1}`
    : stepRefLabel({ stepIndex, supportIndex });
  renderStepPager();

  renderJobPicker();
  renderStepModal();
  if (!$("stepModal").open) $("stepModal").showModal();
  const checked = $("stepJobPicker").querySelector("input:checked");
  checked?.closest(".job").scrollIntoView({ block: "nearest" });
  if (!focusField) return;
  if (isMarkerType(modal.type)) checked?.focus();
  else $("stepTarget").focus();
}

/** Previous/next arrows around the step number — only for existing steps: a new one has no
 *  place in the list to move from until it is saved. */
function renderStepPager() {
  const refs = stepRefs(modal.wf);
  const i = refs.findIndex((r) => r.stepIndex === modal.stepIndex && r.supportIndex === modal.supportIndex);
  for (const [id, dir, key] of [["stepPrev", -1, "prevStep"], ["stepNext", 1, "nextStep"]]) {
    const btn = $(id);
    const ref = refs[i + dir];
    btn.hidden = modal.isNew;
    btn.disabled = !ref;
    btn.title = ref ? t(key, stepRefLabel(ref)) : "";
    btn.setAttribute("aria-label", ref ? btn.title : t(key, "–"));
  }
}

/** Moves the dialog to the neighbouring step. The current step is kept as edited, like Save —
 *  and like Save, a missing target stops the move and focuses the field. */
function navigateStepModal(dir) {
  const refs = stepRefs(modal.wf);
  const i = refs.findIndex((r) => r.stepIndex === modal.stepIndex && r.supportIndex === modal.supportIndex);
  const ref = refs[i + dir];
  if (!ref) return;
  const step = stepFromModal();
  if (!step) return;
  if (!sameStep(step, currentModalStep())) { applyStepModal(step); commit(); }
  openStepModal(modal.wf, { ...ref, focusField: false });
  // Keep focus on the arrow so it can be pressed again; at the end of the list it is disabled
  const btn = dir < 0 ? $("stepPrev") : $("stepNext");
  (btn.disabled ? (dir < 0 ? $("stepNext") : $("stepPrev")) : btn).focus();
}

function currentModalStep() {
  const main = modal.wf.steps[modal.stepIndex];
  return modal.supportIndex != null ? main.support[modal.supportIndex] : main;
}

/** Same step data, ignoring the support list a main step carries, key order, and empty
 *  fields (imported steps hold them as null, the dialog leaves them out). */
function sameStep(a, b) {
  const key = (s) => JSON.stringify(Object.keys(s).filter((k) => k !== "support" && s[k] != null).sort().map((k) => [k, s[k]]));
  return key(a) === key(b);
}

/** Selectable step types for the currently open dialog (mirrors WMStepDialog:getStepTypes).
 *  Sync markers are omitted for support sub-steps: leader/follower pairing is built from
 *  workflow.steps only, so a marker nested under a main step has nothing to pair with and
 *  would abort the workflow in-game. Exception: keep them listed when the sub-step being
 *  edited already is a marker (data saved before the restriction existed), so the control
 *  reflects reality and can convert it. */
function modalStepTypes() {
  const isSupport = modal.isNewSupport || modal.supportIndex != null;
  if (!isSupport || isSyncMarkerType(modal.type)) return STEP_TYPES;
  return STEP_TYPES.filter((t) => !isSyncMarkerType(t));
}

/** "Finish before switching": support sub-steps that run an AD/CP job
 *  (mirrors WMStepDialog:canFinishBeforeSwitch). */
function modalCanFinishBeforeSwitch() {
  const isSupport = modal.isNewSupport || modal.supportIndex != null;
  return isSupport && !isSyncMarkerType(modal.type);
}

function renderFinishBeforeSwitch() {
  const show = modalCanFinishBeforeSwitch();
  $("fieldFinishBeforeSwitch").hidden = !show;
  if (show) $("stepFinishBeforeSwitch").checked = modal.finishBeforeSwitch;
}

/** The job picker's choices: step type plus, for AutoDrive/Courseplay, the action — one
 *  decision for the user, stored as the two fields it always was. Grouped by the system that
 *  runs the job; Park/Refuel/Repair are AutoDrive jobs, so they sit in its group. */
function modalJobGroups() {
  const types = modalStepTypes();
  const groups = [
    { cls: "ad", label: t("typeAd"), jobs: [
      ...AD_ACTIONS.map((action) => ({ type: STEP_AUTODRIVE, action })),
      ...[STEP_PARK, STEP_REFUEL, STEP_REPAIR].map((type) => ({ type })),
    ] },
    { cls: "cp", label: t("typeCp"), jobs: CP_ACTIONS.map((action) => ({ type: STEP_COURSEPLAY, action })) },
    { cls: "marker", label: t("syncGroup"), jobs: [STEP_WAIT_FOR_LEADER, STEP_UNLOCK_FOLLOWER].map((type) => ({ type })) },
  ];
  for (const g of groups) g.jobs = g.jobs.filter((j) => types.includes(j.type));
  return groups.filter((g) => g.jobs.length);
}

/** Built once per opening: rebuilding it on every change would drop the focused radio and
 *  break arrow-key navigation through the group. */
function renderJobPicker() {
  const picker = $("stepJobPicker");
  picker.querySelectorAll(".job-group").forEach((n) => n.remove());
  for (const g of modalJobGroups()) {
    const group = el("div", { class: `job-group ${g.cls}` }, el("div", { class: "job-group-name" }, g.label));
    for (const job of g.jobs) {
      const input = el("input", { type: "radio", name: "stepJob" });
      input.checked = job.type === modal.type && (!job.action || job.action === modal.action);
      input.addEventListener("change", () => selectJob(job));
      group.append(el("label", { class: `job ${typeBadgeClass(job.type)}` },
        input, job.action ? actionLabel(job.action) : stepTypeLabel(job.type)));
    }
    picker.append(group);
  }
}

function selectJob(job) {
  if (job.type !== modal.type) {
    modal.type = job.type;
    $("stepTarget").value = "";
    $("stepUnloadTarget").value = "";
    modal.fillTypes = [];
    modal.seedFruitType = "";
  }
  modal.action = job.action || "drive";
  renderStepModal();
}

function renderStepModal() {
  const marker = isMarkerType(modal.type);
  if (!marker) {
    const actions = modal.type === STEP_AUTODRIVE ? AD_ACTIONS : CP_ACTIONS;
    if (!actions.includes(modal.action)) modal.action = actions[0];
  }
  $("stepDetail").dataset.sys = typeBadgeClass(modal.type);
  $("stepJobTitle").textContent = marker ? stepTypeLabel(modal.type) : actionLabel(modal.action);

  // Before the marker early-out: Park/Refuel/Repair sub-steps take that branch too
  renderFinishBeforeSwitch();

  $("markerInfo").hidden = !marker;
  $("stepRoute").hidden = marker;
  $("targetHint").hidden = marker;
  if (marker) {
    $("markerInfo").textContent = t(stepInfoKey(modal.type));
    $("fieldFillTypes").hidden = true;
    $("fieldSeedType").hidden = true;
    return;
  }

  // Target labels per action (mirrors in-game dialog labels)
  let targetLabel = modal.type === STEP_COURSEPLAY ? t("course") : t("target");
  if (modal.type === STEP_AUTODRIVE) {
    if (modal.action === "unload") targetLabel = t("unloadFirst");
    else if (modal.action === "pickup_deliver") targetLabel = t("pickup");
    else if (modal.action === "load") targetLabel = t("returnTo");
  }
  $("targetLabel").textContent = targetLabel;
  $("targetHint").textContent = modal.type === STEP_AUTODRIVE ? t("targetHintAd") : t("targetHintCp");

  const needsUnload = actionNeedsUnloadTarget(modal.type, modal.action);
  $("fieldUnloadTarget").hidden = !needsUnload;
  if (needsUnload) {
    let ulLabel = t("deliverTo");
    if (modal.action === "unload") ulLabel = t("target");
    else if (modal.action === "load") ulLabel = t("loadAt");
    $("unloadTargetLabel").textContent = ulLabel;
  }
  // Stops in driving order. Load is the one mode that visits its second destination
  // (unloadTarget, "Load At") first and then returns to the target. Moved in the DOM, not
  // with CSS order, so Tab follows the route too.
  const route = $("stepRoute");
  route.append(modal.action === "load" ? $("fieldTarget") : $("fieldUnloadTarget"));
  route.classList.toggle("multi", needsUnload);

  const needsFill = actionNeedsFillType(modal.type, modal.action);
  $("fieldFillTypes").hidden = !needsFill;
  if (needsFill) renderFillPicker();

  const needsSeed = actionNeedsSeedType(modal.type, modal.action);
  $("fieldSeedType").hidden = !needsSeed;
  if (!needsSeed) modal.seedFruitType = "";
  if (needsSeed) renderSeedTypeSelect();
}

function renderSeedTypeSelect() {
  const names = SEED_TYPES.map(([name]) => name);
  // Keep an imported value this list does not know (modded fruit) selectable
  if (modal.seedFruitType && !names.includes(modal.seedFruitType)) names.push(modal.seedFruitType);

  const options = [el("option", { value: "", selected: !modal.seedFruitType }, t("seedTypeNone"))];
  for (const name of names) {
    options.push(el("option", { value: name, selected: name === modal.seedFruitType }, seedTypeLabel(name)));
  }
  $("stepSeedType").replaceChildren(...options);
}

function seedTypeLabel(name) {
  const entry = SEED_TYPES.find(([n]) => n === name);
  if (!entry) return name;
  return state.lang === "de" ? entry[2] : entry[1];
}

function saveStepModal() {
  if (!modal.wf) return;
  const step = stepFromModal();
  if (!step) return;
  applyStepModal(step);
  $("stepModal").close();
  commit();
}

/** The step as the dialog currently describes it, or null when the target is missing
 *  (the field is focused instead). */
function stepFromModal() {
  let step;
  if (isMarkerType(modal.type)) {
    step = { type: modal.type, target: "" };
  } else {
    const target = $("stepTarget").value.trim();
    if (!target) { $("stepTarget").focus(); return null; }
    step = { type: modal.type, action: modal.action, target };
    if (modal.type === STEP_AUTODRIVE) {
      const unload = $("stepUnloadTarget").value.trim();
      if (actionNeedsUnloadTarget(modal.type, modal.action) && unload) step.unloadTarget = unload;
      if (actionNeedsFillType(modal.type, modal.action) && modal.fillTypes.length) step.fillTypes = [...modal.fillTypes];
    } else if (modal.type === STEP_COURSEPLAY) {
      if (actionNeedsSeedType(modal.type, modal.action) && modal.seedFruitType) {
        step.seedFruitType = modal.seedFruitType;
      }
    }
  }
  if (modalCanFinishBeforeSwitch() && modal.finishBeforeSwitch) step.finishBeforeSwitch = true;
  return step;
}

/** Writes `step` into the workflow at the dialog's position. */
function applyStepModal(step) {
  const wf = modal.wf;
  harvestStepTargets(step);
  if (modal.isNewSupport) {
    const main = wf.steps[modal.stepIndex];
    if (!main.support) main.support = [];
    main.support.push(step);
  } else if (modal.supportIndex != null) {
    wf.steps[modal.stepIndex].support[modal.supportIndex] = step;
  } else if (modal.isNew) {
    step.support = [];
    wf.steps.push(step);
  } else {
    step.support = wf.steps[modal.stepIndex].support || [];
    wf.steps[modal.stepIndex] = step;
  }
}

/* ---------- combobox (target / unload target) ---------- */

function comboOptions(kind) {
  return kind === "cp" ? state.targets.cp : state.targets.ad;
}

function setupCombo(inputId, listId, kindFn) {
  const input = $(inputId);
  const list = $(listId);
  let hlIndex = -1;

  const close = () => { list.hidden = true; hlIndex = -1; };

  const open = () => {
    const q = input.value.trim().toLowerCase();
    const opts = comboOptions(kindFn()).filter((o) => !q || o.toLowerCase().includes(q));
    list.replaceChildren();
    if (opts.length === 0) {
      list.append(el("div", { class: "opt none" }, t("noMatches")));
    } else {
      opts.slice(0, 100).forEach((o) => {
        const div = el("div", { class: "opt" }, o);
        // mousedown so it fires before input blur
        div.addEventListener("mousedown", (e) => { e.preventDefault(); input.value = o; close(); });
        list.append(div);
      });
    }
    list.hidden = false;
    hlIndex = -1;
  };

  input.addEventListener("focus", open);
  input.addEventListener("input", open);
  input.addEventListener("blur", () => setTimeout(close, 120));
  input.addEventListener("keydown", (e) => {
    const opts = [...list.querySelectorAll(".opt:not(.none)")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (list.hidden) { open(); return; }
      e.preventDefault();
      hlIndex = e.key === "ArrowDown" ? Math.min(hlIndex + 1, opts.length - 1) : Math.max(hlIndex - 1, 0);
      opts.forEach((o, i) => o.classList.toggle("hl", i === hlIndex));
      opts[hlIndex]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      if (!list.hidden && hlIndex >= 0 && opts[hlIndex]) {
        e.preventDefault();
        input.value = opts[hlIndex].textContent;
        close();
      }
    } else if (e.key === "Escape" && !list.hidden) {
      // preventDefault, not just stopPropagation: closing a <dialog> on Escape is the key's
      // DEFAULT ACTION, so without this the first Escape also discards the whole step dialog.
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  });
}

/* ---------- fill type picker ---------- */

function renderFillChips() {
  const selWrap = $("fillSelected");
  selWrap.replaceChildren();
  for (const name of modal.fillTypes) {
    const chip = el("span", { class: "chip" }, fillTypeTitle(name));
    const x = el("button", { type: "button", "aria-label": t("tgRemove", fillTypeTitle(name)) }, "✕");
    x.addEventListener("click", () => {
      modal.fillTypes = modal.fillTypes.filter((n) => n !== name);
      renderFillPicker();
    });
    chip.append(x);
    selWrap.append(chip);
  }
}

function renderFillPicker() {
  renderFillChips();

  const q = $("fillSearch").value.trim().toLowerCase();
  const list = $("fillList");
  list.replaceChildren();
  const fts = allFillTypes().filter((f) =>
    !q || f.title.toLowerCase().includes(q) || f.name.toLowerCase().includes(q));

  if (fts.length === 0) {
    // Allow adding a custom (mod) fill type ID by typing it
    const custom = $("fillSearch").value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
    if (custom) {
      const addRow = el("div", { class: "ft" }, `+ "${custom}"`);
      addRow.addEventListener("click", () => {
        state.customFillTypes.push({ name: custom, title: custom });
        modal.fillTypes.push(custom);
        $("fillSearch").value = "";
        saveState();
        renderFillPicker();
      });
      list.append(addRow);
    } else {
      list.append(el("div", { class: "none" }, t("noEntries")));
    }
    return;
  }

  for (const f of fts) {
    const checked = modal.fillTypes.includes(f.name);
    const cb = el("input", { type: "checkbox" });
    cb.checked = checked;
    const row = el("label", { class: "ft" }, cb, f.title, el("span", { class: "ft-id" }, f.name));
    cb.addEventListener("change", () => {
      if (cb.checked) modal.fillTypes.push(f.name);
      else modal.fillTypes = modal.fillTypes.filter((n) => n !== f.name);
      renderFillChips(); // not the list: that would drop the focused checkbox and close it
    });
    list.append(row);
  }
}

/* ============================================================
   Targets modal
   ============================================================ */

const TARGET_INPUT = { ad: "newAdTarget", cp: "newCpTarget" };
const TARGET_ADD = { ad: "btnAddAdTarget", cp: "btnAddCpTarget" };

function renderTargetsModal() {
  $("targetsScope").textContent = link.dir ? t("targetsScope", link.dir.name) : t("targetsScopeNone");

  // A savegame scan replaces the list, so a manual import only matters while nothing is linked —
  // or when the scan did not find the file, and then it is the one thing to do.
  const needAd = link.dir && targetsNeed.ad ? targetsNeed.ad.need : null;
  $("adSource").textContent = needAd === "missing" ? t("tgAdNeedMissing", link.dir.name)
    : needAd ? t("tgAdNeedFailed")
    : link.dir ? t("tgAdSourceLinked", link.dir.name)
    : canLinkSavegame ? t("tgAdSourceOpen") : t("tgAdSourceManual");
  $("adPanel").classList.toggle("needs", !!needAd);
  const adBtn = $("btnImportAdConfig");
  adBtn.hidden = !!link.dir && !needAd;
  adBtn.classList.toggle("primary", !!needAd);
  adBtn.classList.toggle("ghost", !needAd);
  adBtn.title = t("importAdTitle");

  const needCp = link.dir && targetsNeed.cp ? targetsNeed.cp : null;
  const regrant = needCp?.need === "permission";
  const linkBtn = $("btnLinkCpFolder");
  linkBtn.hidden = !canLinkSavegame;
  linkBtn.textContent = t(regrant ? "allowAccess" : courses.dir ? "relinkCpFolder" : "linkCpFolder");
  linkBtn.title = regrant ? "" : t("linkCpFolderTitle");
  linkBtn.classList.toggle("primary", !courses.dir || !!needCp); // the one thing to do
  linkBtn.classList.toggle("ghost", !!courses.dir && !needCp);
  $("cpPanel").classList.toggle("needs", !!needCp);
  $("cpSource").textContent = !canLinkSavegame ? t("tgCpSourceManual")
    : needCp?.need === "unlinked" ? t("tgCpNeedUnlinked")
    : regrant ? t("tgCpNeedPermission")
    : needCp?.need === "otherMap" ? t("tgCpNeedOtherMap", courses.mapId, needCp.mapId)
    : needCp?.need === "failed" ? t("tgCpNeedFailed")
    : !courses.dir ? t("tgCpSourceUnlinked")
    : courses.mapId ? t("tgCpSourceMap", courses.mapId) : t("tgCpSourceLinked");
  $("btnImportCpCourses").hidden = !!courses.dir;
  $("btnImportCpCourses").title = t("importCpTitle");

  renderTargetList("ad");
  renderTargetList("cp");
}

/** The group a name is listed under in-game, and the rest: AutoDrive destinations are
 *  "group/marker", courses are folder paths ("Singleplayer/F01/Kalken" sits in folder "F01"). */
function targetGroup(kind, name) {
  const cut = kind === "ad" ? name.indexOf("/") : name.lastIndexOf("/");
  if (cut <= 0) return { group: "", leaf: name };
  const group = name.slice(0, cut);
  return { group: kind === "cp" ? group.replace(/^Singleplayer(\/|$)/, "") : group, leaf: name.slice(cut + 1) };
}

/** One list, filtered by its input and grouped like the game groups it. */
// Folded groups per list, for this page visit. While filtering, every match is shown anyway.
const collapsedGroups = { ad: new Set(), cp: new Set() };

function removeTargets(kind, names) {
  const drop = new Set(names);
  state.targets[kind] = state.targets[kind].filter((n) => !drop.has(n));
  saveState();
  renderTargetList(kind);
}

/** Confirms removing several entries; names that a scan or the workflows bring back say so. */
function confirmRemoveTargets(kind, names, text) {
  if (names.length === 1) { removeTargets(kind, names); return; }
  const refilled = kind === "ad" ? !!link.dir : !!(link.dir && courses.dir);
  askConfirm(text + (refilled ? t("tgComesBack") : ""), () => removeTargets(kind, names), "remove");
}

function renderTargetList(kind) {
  const ul = $(`${kind}TargetItems`);
  const query = $(TARGET_INPUT[kind]).value.trim();
  const q = query.toLowerCase();
  const all = state.targets[kind];
  const shown = all.filter((n) => !q || n.toLowerCase().includes(q));
  $(`${kind}Count`).textContent = q ? t("tgCountFiltered", shown.length, all.length) : String(all.length);
  $(TARGET_ADD[kind]).disabled = !query || all.includes(query);
  // Clear removes what is listed: everything, or only the matches while filtering.
  const clear = $(`${kind}Clear`);
  clear.hidden = shown.length === 0;
  clear.title = t("tgClearTitle");
  clear.onclick = () => confirmRemoveTargets(kind, shown, q ? t("confirmClearFiltered", shown.length, query)
    : t(kind === "ad" ? "confirmClearAd" : "confirmClearCp", shown.length));

  // Re-rendering replaces every button; keep keyboard focus where it was — on the same group's
  // toggle, or on the remove button that took the removed row's place.
  const active = ul.contains(document.activeElement) ? document.activeElement : null;
  const focusGroup = active?.classList.contains("tg-toggle") ? active.dataset.group : null;
  const focusIndex = active ? [...ul.querySelectorAll(".tg-remove")].indexOf(active) : -1;
  ul.replaceChildren();
  if (shown.length === 0) {
    ul.append(el("li", { class: "none" }, q ? t("tgNoMatch", query) : t(kind === "ad" ? "tgAdEmpty" : "tgCpEmpty")));
    return;
  }

  const byGroup = new Map();
  for (const name of shown) {
    const { group, leaf } = targetGroup(kind, name);
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push({ name, leaf });
  }
  // Numeric collation: "Feld 9" before "Feld 10", as the game's own lists sort.
  const coll = new Intl.Collator(state.lang, { numeric: true });
  const groups = [...byGroup.keys()].sort((a, b) => (a ? 1 : 0) - (b ? 1 : 0) || coll.compare(a, b));
  for (const group of groups) {
    const items = byGroup.get(group).sort((a, b) => coll.compare(a.leaf, b.leaf));
    const label = group || t(kind === "ad" ? "tgAdNoGroup" : "tgCpNoGroup");
    const collapsed = !q && collapsedGroups[kind].has(group);
    const toggle = el("button", { type: "button", class: "tg-toggle", "data-group": group, "aria-expanded": String(!collapsed), disabled: !!q },
      el("span", { class: "tg-chev", "aria-hidden": "true" }),
      el("span", { class: "tg-group-name" }, label),
      el("span", { class: "tg-group-n" }, String(items.length)));
    toggle.addEventListener("click", () => {
      const set = collapsedGroups[kind];
      if (set.has(group)) set.delete(group); else set.add(group);
      renderTargetList(kind);
    });
    const removeLabel = t(kind === "ad" ? "tgRemoveGroupAd" : "tgRemoveGroupCp", label);
    const rmGroup = el("button", { type: "button", class: "tg-remove", "aria-label": removeLabel, title: removeLabel }, "✕");
    rmGroup.addEventListener("click", () => confirmRemoveTargets(kind, items.map((i) => i.name),
      t(kind === "ad" ? "confirmRemoveGroupAd" : "confirmRemoveGroupCp", label, items.length)));
    ul.append(el("li", { class: `tg-group${collapsed ? " collapsed" : ""}` }, toggle, rmGroup));
    if (collapsed) continue;
    for (const { name, leaf } of items) {
      const rm = el("button", { type: "button", class: "tg-remove", "aria-label": t("tgRemove", name), title: t("tgRemove", name) }, "✕");
      rm.addEventListener("click", () => {
        state.targets[kind] = state.targets[kind].filter((n) => n !== name);
        saveState();
        renderTargetList(kind);
      });
      ul.append(el("li", { class: "tg-item" }, el("span", { title: name }, leaf), rm));
    }
  }
  if (focusGroup != null) {
    ul.querySelector(`.tg-toggle[data-group="${CSS.escape(focusGroup)}"]`)?.focus();
  } else if (focusIndex >= 0) {
    const next = ul.querySelectorAll(".tg-remove");
    (next[focusIndex] || next[next.length - 1])?.focus();
  }
}

function addTargetFromInput(kind) {
  const input = $(TARGET_INPUT[kind]);
  const name = input.value.trim();
  if (!name) return;
  rememberTarget(kind, name);
  input.value = "";
  saveState();
  renderTargetList(kind);
}

/* ============================================================
   File import / export
   ============================================================ */

function harvestWorkflowTargets() {
  for (const wf of state.workflows) {
    for (const step of wf.steps) {
      harvestStepTargets(step);
      for (const sub of step.support || []) harvestStepTargets(sub);
    }
  }
}

function applyImport(result) {
  state.workflows = result.workflows;
  harvestWorkflowTargets();
  // Reloading the same savegame keeps the workflow being edited open.
  if (!state.workflows.some((w) => w.id === state.selectedId)) state.selectedId = state.workflows[0]?.id || null;
  if (result.migrated) toast(t("toastMigrated"));
  toast(t("toastImported", state.workflows.length));
  commit();
}

function handleWorkflowText(text) {
  const result = importWorkflowsXml(text);
  if (!result) { toast(t("toastImportFailed"), true); return; }
  const apply = () => applyImport(result);
  // An import replaces everything and autosaves over localStorage right after — there is no
  // undo, and the page can be dropped on by accident, so confirm while something is at stake.
  if (state.workflows.length > 0) {
    askConfirm(t("confirmImportReplace", state.workflows.length), apply, "replace");
  } else {
    apply();
  }
}

function handleWorkflowFile(file) {
  file.text().then((text) => handleWorkflowText(text));
}

function downloadExport() {
  if (state.workflows.length === 0) { toast(t("toastNothingToExport"), true); return; }
  const xml = exportWorkflowsXml();
  const blob = new Blob([xml], { type: "text/xml" });
  const a = el("a", { href: URL.createObjectURL(blob), download: "workflowManager.xml" });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast(t("toastExported"));
}

/* ============================================================
   Savegame folder link (File System Access API — Chromium browsers only;
   everywhere else Import/Export via file picker and download stays the only way)
   ============================================================ */

const WM_FILE = "workflowManager.xml";
const canLinkSavegame = typeof window.showDirectoryPicker === "function";
// The linked savegame folder, and the file's lastModified when this editor last read or wrote
// it. The game rewrites the file on every in-game edit and game save, so a different value on
// Save means writing now would silently drop those changes. `synced` is this editor's export at
// that moment: while the export still equals it, reloading cannot lose anything.
const link = { dir: null, mtime: null, synced: null };
// Courseplay's "Courses" folder (…/modSettings/FS25_Courseplay/Courses). Courses are kept outside
// the savegame, per map (Courses/<mapId>), so they need a folder link of their own. `mapId` is set
// when the link is a single map's folder instead.
const courses = { dir: null, mapId: null };

/** Runs one request against the "handles" IndexedDB store — localStorage cannot hold a
 *  directory handle, IndexedDB can, so the link survives a page reload. */
function idbHandles(mode, makeRequest) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("fs25wm.webeditor", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("handles");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("handles", mode);
      const req = makeRequest(tx.objectStore("handles"));
      tx.oncomplete = () => { db.close(); resolve(req.result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}

function storeLink() {
  idbHandles("readwrite", (s) => s.put({ dir: link.dir, mtime: link.mtime, synced: link.synced }, "savegame"))
    .catch(() => { /* blocked storage — the link just lasts until the page is closed */ });
}

function storeCoursesLink() {
  idbHandles("readwrite", (s) => s.put({ dir: courses.dir, mapId: courses.mapId }, "courses"))
    .catch(() => { /* blocked storage — the link just lasts until the page is closed */ });
}

async function restoreLink() {
  if (!canLinkSavegame) return;
  try {
    const saved = await idbHandles("readonly", (s) => s.get("savegame"));
    if (saved && saved.dir) {
      link.dir = saved.dir; link.mtime = saved.mtime ?? null; link.synced = saved.synced ?? null;
      useLibrary(link.dir.name);
    }
    const cp = await idbHandles("readonly", (s) => s.get("courses"));
    if (cp && cp.dir) { courses.dir = cp.dir; courses.mapId = cp.mapId ?? null; }
  } catch (e) { /* blocked storage — start unlinked */ }
}

/** A restored handle needs its permission re-granted after a page reload; requestPermission
 *  only works inside the click that started the call (it throws otherwise). */
async function ensurePermission(handle, mode) {
  const opts = { mode };
  try {
    return (await handle.queryPermission(opts)) === "granted"
      || (await handle.requestPermission(opts)) === "granted";
  } catch (e) { return false; }
}

async function readSavegameFile(dir, name = WM_FILE) {
  try {
    return await (await dir.getFileHandle(name)).getFile();
  } catch (e) {
    if (e.name === "NotFoundError") return null;
    throw e;
  }
}

/** Course names of one map as Courseplay resolves them — relative to Courses/<mapId>, e.g.
 *  "Singleplayer/F01/Kalken". Empty when nobody saved a course on that map yet.
 *  @param mapId null when `coursesDir` already is the map's folder. */
async function courseNamesForMap(coursesDir, mapId) {
  let mapDir = coursesDir;
  if (mapId) {
    try { mapDir = await coursesDir.getDirectoryHandle(mapId); } catch (e) {
      if (e.name === "NotFoundError") return [];
      throw e;
    }
  }
  const names = [];
  const walk = async (dir, prefix) => {
    for await (const handle of dir.values()) {
      const path = prefix + handle.name;
      if (handle.kind === "directory") await walk(handle, `${path}/`);
      else if (await isCourseFile(await handle.getFile())) names.push(path);
    }
  };
  await walk(mapDir, "");
  return names;
}

/* Each reader returns { names } when its list was found, or { need } naming why it was not — the
   Targets dialog then asks the user to link or import it by hand. */

/** AutoDrive keeps its network, map markers included, in the savegame folder. */
async function readAdTargets(dir) {
  try {
    const file = await readSavegameFile(dir, "AutoDrive_config.xml");
    return file ? { names: adMarkerNames(await file.text()) } : { need: "missing" };
  } catch (e) { return { need: "failed" }; }
}

/** Courseplay keeps its courses outside the savegame, per map: <Courses>/<mapId>. A linked map
 *  folder only serves savegames on that map. */
async function readCpTargets(dir) {
  if (!courses.dir) return { need: "unlinked" };
  if (!(await ensurePermission(courses.dir, "read"))) return { need: "permission" };
  try {
    const career = await readSavegameFile(dir, "careerSavegame.xml");
    const mapId = career && new DOMParser().parseFromString(await career.text(), "text/xml")
      .querySelector("mapId")?.textContent.trim();
    if (!mapId) return {};
    if (courses.mapId && courses.mapId !== mapId) return { need: "otherMap", mapId };
    return { mapId, names: await courseNamesForMap(courses.dir, courses.mapId ? null : mapId) };
  } catch (e) { return { need: "failed" }; }
}

/** Whether the editor's workflows use a system's steps (AutoDrive also drives Park/Refuel/Repair). */
function workflowsUse(kind) {
  const uses = kind === "cp" ? (type) => type === STEP_COURSEPLAY
    : (type) => type === STEP_AUTODRIVE || type === STEP_PARK || type === STEP_REFUEL || type === STEP_REPAIR;
  return state.workflows.some((w) => w.steps.some((s) => uses(s.type) || (s.support || []).some((u) => uses(u.type))));
}

// What the last scan could not find by itself, per list: { need, mapId? } or null. Shown as a
// callout in that half of the Targets dialog, next to the button that fixes it.
const targetsNeed = { ad: null, cp: null };

/** Replaces one of the open savegame's target lists with what the mods' files hold. Names the
 *  workflows use stay in, as after an import. */
function replaceTargets(kind, names) {
  state.targets[kind] = [];
  for (const name of names) rememberTarget(kind, name);
  harvestWorkflowTargets();
}

/** Reads the open savegame's AutoDrive destinations and Courseplay courses. Whatever is not found
 *  automatically opens the Targets dialog at that list to ask for it by hand — AutoDrive only when
 *  the workflows use it (it is optional), Courseplay unless workflows exist and none uses it. */
async function scanSavegameTargets() {
  const dir = link.dir;
  const ad = await readAdTargets(dir);
  const cp = await readCpTargets(dir);
  if (link.dir !== dir) return; // another savegame was opened meanwhile
  if (ad.names) { replaceTargets("ad", ad.names); toast(t("toastAdScanned", ad.names.length)); }
  if (cp.names) { replaceTargets("cp", cp.names); toast(t("toastCpScanned", cp.names.length, cp.mapId)); }
  targetsNeed.ad = ad.need && workflowsUse("ad") ? { need: ad.need } : null;
  targetsNeed.cp = cp.need && (state.workflows.length === 0 || workflowsUse("cp")) ? { need: cp.need, mapId: cp.mapId } : null;
  saveState();
  if (targetsNeed.ad || targetsNeed.cp) openTargetsModal();
  else if ($("targetsModal").open) renderTargetsModal();
}

function openTargetsModal() {
  const wasOpen = $("targetsModal").open;
  if (!wasOpen) { $(TARGET_INPUT.ad).value = ""; $(TARGET_INPUT.cp).value = ""; }
  renderTargetsModal();
  if (!wasOpen) $("targetsModal").showModal();
  // Straight to the button that fixes what is missing
  const fix = targetsNeed.cp ? "btnLinkCpFolder" : targetsNeed.ad ? "btnImportAdConfig" : null;
  if (fix && link.dir) $(fix).focus();
}

/** The Courseplay half's button: link (or change) the Courses folder, or re-grant access to it. */
async function onCpFolderButton() {
  if (targetsNeed.cp?.need === "permission" && courses.dir) {
    if (await ensurePermission(courses.dir, "read")) {
      targetsNeed.cp = null;
      renderTargetsModal();
      scanSavegameTargets();
    }
    return;
  }
  linkCoursesFolder();
}

/** Loads dir's workflowManager.xml into the editor, links dir and refreshes its target lists.
 *  @param confirmText asked first when set — loading replaces the editor's workflows. */
async function loadSavegame(dir, confirmText) {
  let file;
  try { file = await readSavegameFile(dir); } catch (e) { toast(t("toastSavegameReadFailed"), true); return; }
  const result = file && importWorkflowsXml(await file.text());
  if (file && !result) { toast(t("toastImportFailed"), true); return; }
  const apply = () => {
    link.dir = dir;
    link.mtime = file ? file.lastModified : null;
    useLibrary(dir.name);
    if (result) applyImport(result);
    else { toast(t("toastSavegameNoFile", dir.name)); render(); }
    link.synced = result ? exportWorkflowsXml() : null;
    storeLink();
    scanSavegameTargets();
  };
  if (result && confirmText) askConfirm(confirmText, apply, "replace");
  else apply();
}

async function openSavegame() {
  let dir;
  try {
    dir = await window.showDirectoryPicker({ mode: "readwrite", startIn: link.dir || "documents" });
  } catch (e) { return; } // picker cancelled
  openSavegameDir(dir);
}

/** Link a folder from the picker or dropped on the page: a savegame, or the game's user folder
 *  (…/FarmingSimulator2025), which holds every savegame and Courseplay's courses. */
async function openSavegameDir(dir) {
  const isSavegame = await dir.getFileHandle("careerSavegame.xml").then(() => true, () => false);
  if (!isSavegame) {
    const saves = await listSavegames(dir);
    if (saves.length > 0 || (await hasDirectory(dir, "modSettings"))) { openGameFolder(dir, saves); return; }
    toast(t("toastNotSavegame", dir.name), true);
  }
  // An import replaces everything and autosaves over localStorage right after — no undo.
  loadSavegame(dir, state.workflows.length > 0 ? t("confirmImportReplace", state.workflows.length) : null);
}

const hasDirectory = (dir, name) => dir.getDirectoryHandle(name).then(() => true, () => false);

/** The game's savegame slots (savegame1…savegame20) that hold a game, most recently saved first.
 *  Copies like "savegame2 - Kopie" are left out: the game never loads them. */
async function listSavegames(gameDir) {
  const saves = [];
  try {
    for await (const handle of gameDir.values()) {
      if (handle.kind !== "directory" || !/^savegame\d+$/.test(handle.name)) continue;
      const career = await readSavegameFile(handle, "careerSavegame.xml").catch(() => null);
      if (!career) continue; // empty slot
      const doc = new DOMParser().parseFromString(await career.text(), "text/xml");
      const get = (tag) => doc.querySelector(tag)?.textContent.trim() || "";
      saves.push({
        dir: handle, name: get("savegameName"), map: get("mapTitle") || get("mapId"),
        date: get("saveDate"), dateText: get("saveDateFormatted") || get("saveDate"),
        hasWorkflows: !!(await readSavegameFile(handle).catch(() => null)),
      });
    }
  } catch (e) { /* unreadable folder — whatever was listed so far */ }
  const bySlot = new Intl.Collator(undefined, { numeric: true });
  return saves.sort((a, b) => b.date.localeCompare(a.date) || bySlot.compare(a.dir.name, b.dir.name));
}

/** Links the Courses folder found under the game folder, then opens its one savegame or asks
 *  which one. */
async function openGameFolder(gameDir, saves) {
  let cp = gameDir;
  for (const name of ["modSettings", "FS25_Courseplay", "Courses"]) {
    cp = cp && (await cp.getDirectoryHandle(name).catch(() => null));
  }
  if (cp) {
    courses.dir = cp;
    courses.mapId = null;
    storeCoursesLink();
    toast(t("toastCpFound"));
  }
  if (saves.length === 0) { toast(t("toastNoSavegames", gameDir.name), true); return; }
  if (saves.length === 1) { openSavegameDir(saves[0].dir); return; }
  renderSavegameChooser(gameDir, saves);
  $("savegameModal").showModal();
}

function renderSavegameChooser(gameDir, saves) {
  $("savegameScope").textContent = t("sgScope", gameDir.name);
  $("savegameList").replaceChildren(...saves.map((sg) => {
    const current = link.dir && link.dir.name === sg.dir.name;
    const pick = el("button", { type: "button", class: "sg-item" },
      el("span", { class: "sg-map" }, sg.map || sg.dir.name),
      el("span", { class: "sg-date" }, sg.dateText),
      el("span", { class: "sg-name" }, sg.name ? t("sgNameSlot", sg.name, sg.dir.name) : sg.dir.name),
      el("span", { class: "sg-tags" },
        current ? el("span", { class: "sg-tag now" }, t("sgOpenNow")) : null,
        sg.hasWorkflows ? el("span", { class: "sg-tag" }, t("sgHasWorkflows")) : null));
    pick.addEventListener("click", () => { $("savegameModal").close(); openSavegameDir(sg.dir); });
    return el("li", {}, pick);
  }));
}

/** Re-reads the linked savegame, e.g. after workflows were edited in-game or AutoDrive markers
 *  and Courseplay courses changed. Asks only when edits made here were not saved to it. */
async function reloadSavegame() {
  if (!(await ensurePermission(link.dir, "readwrite"))) return;
  const unsaved = state.workflows.length > 0 && exportWorkflowsXml() !== link.synced;
  loadSavegame(link.dir, unsaved ? t("confirmReloadDiscard", link.dir.name) : null);
}

/** Accepts the game's user folder or any folder on the way down to Courses (all maps), or one
 *  map's folder inside Courses — the one that holds "Singleplayer", which the import also takes. */
async function linkCoursesFolder() {
  let dir;
  try {
    dir = await window.showDirectoryPicker({ startIn: courses.dir || "documents" });
  } catch (e) { return; } // picker cancelled
  for (const name of ["modSettings", "FS25_Courseplay", "Courses"]) {
    dir = await dir.getDirectoryHandle(name).catch(() => dir);
  }
  const isMapFolder = dir.name !== "Courses"
    && (await dir.getDirectoryHandle("Singleplayer").then(() => true, () => false));
  if (dir.name !== "Courses" && !isMapFolder) { toast(t("toastNotCoursesFolder", dir.name), true); return; }
  courses.dir = dir;
  courses.mapId = isMapFolder ? dir.name : null;
  targetsNeed.cp = null;
  storeCoursesLink();
  renderTargetsModal();
  toast(t("toastCpLinked"));
  // After a page reload the savegame link may need a permission prompt — Reload does that.
  if (link.dir && (await link.dir.queryPermission({ mode: "read" })) === "granted") scanSavegameTargets();
}

async function writeSavegameFile() {
  try {
    const xml = exportWorkflowsXml();
    const handle = await link.dir.getFileHandle(WM_FILE, { create: true });
    const writable = await handle.createWritable();
    await writable.write(xml);
    await writable.close();
    link.mtime = (await handle.getFile()).lastModified;
    link.synced = xml;
    storeLink();
    toast(t("toastSaved", link.dir.name));
  } catch (e) { toast(t("toastSaveFailed", link.dir.name), true); }
}

async function saveToSavegame() {
  if (state.workflows.length === 0) { toast(t("toastNothingToExport"), true); return; }
  if (!(await ensurePermission(link.dir, "readwrite"))) return;
  let current;
  try {
    current = await readSavegameFile(link.dir);
  } catch (e) { toast(t("toastSaveFailed", link.dir.name), true); return; }
  if (current && current.lastModified !== link.mtime) {
    askConfirm(t("confirmOverwriteChanged", link.dir.name), writeSavegameFile, "overwrite");
    return;
  }
  writeSavegameFile();
}

/* ============================================================
   Wiring
   ============================================================ */

function init() {
  loadState();
  applyTheme();

  // Topbar
  $("btnTheme").addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme;
    state.theme = cur === "dark" ? "light" : "dark";
    saveState();
    applyTheme();
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

  $("btnLang").addEventListener("click", () => {
    state.lang = state.lang === "en" ? "de" : "en";
    commit();
  });

  $("btnImport").addEventListener("click", () => $("fileImport").click());
  $("btnEmptyImport").addEventListener("click", () => $("fileImport").click());
  $("fileImport").addEventListener("change", (e) => {
    if (e.target.files[0]) handleWorkflowFile(e.target.files[0]);
    e.target.value = "";
  });
  $("btnOpenSavegame").addEventListener("click", openSavegame);
  $("btnEmptyOpenSavegame").addEventListener("click", openSavegame);
  $("btnReload").addEventListener("click", reloadSavegame);
  $("btnExport").addEventListener("click", () => (link.dir ? saveToSavegame() : downloadExport()));

  $("btnTargets").addEventListener("click", openTargetsModal);

  // Sidebar
  $("btnNewWorkflow").addEventListener("click", createWorkflow);
  $("btnEmptyNew").addEventListener("click", createWorkflow);
  $("wfSearch").addEventListener("input", renderSidebar);

  // Workflow header
  $("wfName").addEventListener("input", () => {
    const wf = selectedWorkflow();
    if (wf) { wf.name = $("wfName").value; saveState(); renderSidebar(); }
  });

  // AD settings (stored like the game: fill levels as 0..1, pipe offset in meters)
  const bindAd = (inputId, key, scale) => {
    $(inputId).addEventListener("input", () => {
      const wf = selectedWorkflow();
      if (!wf) return;
      if (!wf.adSettings) wf.adSettings = {};
      const v = parseFloat($(inputId).value);
      wf.adSettings[key] = Number.isFinite(v) ? v / scale : null;
      saveState();
      const s = wf.adSettings;
      const nSet = [s.unloadFillLevel, s.pipeOffset, s.preCallLevel].filter((x) => x != null).length;
      $("adSettingsSummary").textContent = nSet ? t("settingsSet", nSet) : t("settingsNone");
    });
  };
  bindAd("adUnloadFill", "unloadFillLevel", 100);
  bindAd("adPipeOffset", "pipeOffset", 1);
  bindAd("adPreCall", "preCallLevel", 100);

  // Steps
  $("btnAddStep").addEventListener("click", () => {
    const wf = selectedWorkflow();
    if (wf) openStepModal(wf, {});
  });
  $("btnQuickWait").addEventListener("click", () => {
    const wf = selectedWorkflow();
    if (wf) addMarkerStep(wf, STEP_WAIT_FOR_LEADER);
  });
  $("btnQuickUnlock").addEventListener("click", () => {
    const wf = selectedWorkflow();
    if (wf) addMarkerStep(wf, STEP_UNLOCK_FOLLOWER);
  });
  $("btnQuickPark").addEventListener("click", () => {
    const wf = selectedWorkflow();
    if (wf) addMarkerStep(wf, STEP_PARK);
  });
  $("btnQuickRefuel").addEventListener("click", () => {
    const wf = selectedWorkflow();
    if (wf) addMarkerStep(wf, STEP_REFUEL);
  });
  $("btnQuickRepair").addEventListener("click", () => {
    const wf = selectedWorkflow();
    if (wf) addMarkerStep(wf, STEP_REPAIR);
  });

  // Step modal
  $("stepForm").addEventListener("submit", (e) => { e.preventDefault(); saveStepModal(); });
  $("stepPrev").addEventListener("click", () => navigateStepModal(-1));
  $("stepNext").addEventListener("click", () => navigateStepModal(1));
  $("fillSearch").addEventListener("input", renderFillPicker);
  // The fill-type list is shown only while the search field or the list has focus. The list
  // is tabindex=-1 so a click on a row's text keeps focus inside it — otherwise the list
  // would hide on mousedown and the click would never land.
  const fillPicker = $("fillPicker");
  const inFillList = (node) => node === $("fillSearch") || $("fillList").contains(node);
  fillPicker.addEventListener("focusin", (e) => { if (inFillList(e.target)) fillPicker.classList.add("open"); });
  fillPicker.addEventListener("focusout", (e) => { if (!inFillList(e.relatedTarget)) fillPicker.classList.remove("open"); });
  fillPicker.addEventListener("keydown", (e) => {
    // preventDefault: Escape closing the <dialog> is the key's default action
    if (e.key === "Escape" && fillPicker.classList.contains("open")) {
      e.preventDefault();
      fillPicker.classList.remove("open");
    }
  });
  $("stepSeedType").addEventListener("change", (e) => { modal.seedFruitType = e.target.value; });
  $("stepFinishBeforeSwitch").addEventListener("change", (e) => { modal.finishBeforeSwitch = e.target.checked; });
  setupCombo("stepTarget", "targetComboList", () => (modal.type === STEP_COURSEPLAY ? "cp" : "ad"));
  setupCombo("stepUnloadTarget", "unloadComboList", () => "ad");

  // Targets modal
  for (const kind of ["ad", "cp"]) {
    const input = $(TARGET_INPUT[kind]);
    $(TARGET_ADD[kind]).addEventListener("click", () => addTargetFromInput(kind));
    input.addEventListener("input", () => renderTargetList(kind));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addTargetFromInput(kind); }
      // First Escape clears the filter; preventDefault keeps it from also closing the dialog.
      else if (e.key === "Escape" && input.value) { e.preventDefault(); input.value = ""; renderTargetList(kind); }
    });
  }
  $("btnImportAdConfig").addEventListener("click", () => $("fileAdConfig").click());
  $("fileAdConfig").addEventListener("change", (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    file.text().then((text) => {
      const n = importAdConfigXml(text);
      if (n < 0) toast(t("toastAdImportFailed"), true);
      else { toast(t("toastAdImported", n)); targetsNeed.ad = null; saveState(); renderTargetsModal(); }
    });
  });
  $("btnImportCpCourses").addEventListener("click", () => $("fileCpCourses").click());
  $("fileCpCourses").addEventListener("change", (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    importCpCourseFiles(files).then((n) => {
      toast(t("toastCpImported", n));
      if (n > 0) targetsNeed.cp = null;
      saveState();
      renderTargetsModal();
    });
  });
  $("btnLinkCpFolder").addEventListener("click", onCpFolderButton);

  // Confirm modal
  $("confirmOk").addEventListener("click", () => {
    $("confirmModal").close();
    const cb = confirmCallback;
    confirmCallback = null;
    if (cb) cb();
  });
  $("confirmCancel").addEventListener("click", () => { confirmCallback = null; $("confirmModal").close(); });

  // Generic close buttons
  document.querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => $(b.dataset.close).close()));

  // Drag & drop file import
  let dragDepth = 0;
  window.addEventListener("dragenter", (e) => {
    if ([...e.dataTransfer.types].includes("Files")) {
      dragDepth++;
      $("dropOverlay").classList.add("active");
    }
  });
  window.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) $("dropOverlay").classList.remove("active");
  });
  window.addEventListener("dragover", (e) => {
    if ([...e.dataTransfer.types].includes("Files")) e.preventDefault();
  });
  window.addEventListener("drop", (e) => {
    dragDepth = 0;
    $("dropOverlay").classList.remove("active");
    const file = [...e.dataTransfer.files].find((f) => /\.xml$/i.test(f.name));
    // Chrome/Edge hand a dropped folder over as a handle, like the Open savegame picker does.
    // getAsFileSystemHandle must be called during the event, before anything is awaited.
    const items = canLinkSavegame
      ? [...e.dataTransfer.items].filter((i) => i.kind === "file" && typeof i.getAsFileSystemHandle === "function")
      : [];
    if (!file && items.length === 0) return;
    e.preventDefault();
    if (items.length === 0) { handleWorkflowFile(file); return; }
    Promise.all(items.map((i) => i.getAsFileSystemHandle())).then((handles) => {
      const dir = handles.find((h) => h && h.kind === "directory");
      if (dir) openSavegameDir(dir);
      else if (file) handleWorkflowFile(file);
    });
  });

  render();
  restoreLink().then(() => { if (link.dir) render(); });
}

document.addEventListener("DOMContentLoaded", init);
