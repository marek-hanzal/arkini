# Arkini: second deep regression audit

Audit date: 2026-09-05. Result: **3 P1, 2 P2**, all backed by executable reproductions. This document records the completed audit. All five findings remain unresolved; this PR changes documentation only.

## Baseline and method

- Branch: `codex/deep-regression-hunt-2`, created from fetched `origin/main`.
- Audited baseline: `696a4a2b3d194f13e53c04a99bf3f4f0f7f921f1`; production source is unchanged in this PR. [PR #694](https://github.com/marek-hanzal/arkini/pull/694) is merged into main at this commit (2026-09-04 22:03:56 UTC).
- Toolchain: Node 24.19.0, npm 12.0.2, argc 1.24.0, Vitest 4.1.11.
- Evidence: current source, applicable AGENTS/GAME contracts and domain maps, existing tests, temporary synthetic probes. Three independent read-only reviewers covered engine, Editor/Board, and MCP/settlement. The coordinating reviewer challenged findings and independently reran Board, engine and MCP reproductions.
- Diagnostic tests were temporary and archived locally outside the repository; they are not included in this PR. Expected-red tests assert the missing correct behavior; passing diagnostic tests explicitly assert the currently broken behavior. Neither means a fix has landed.

## P1 — queued external charge payer can freeze the entire game

**Location:** [src/production-action/fx/resolveActionChargeFx.ts:51](https://github.com/marek-hanzal/arkini/blob/696a4a2b3d194f13e53c04a99bf3f4f0f7f921f1/src/production-action/fx/resolveActionChargeFx.ts#L51) and [src/production-action/fx/resolveActionDepositInputFx.ts:91](https://github.com/marek-hanzal/arkini/blob/696a4a2b3d194f13e53c04a99bf3f4f0f7f921f1/src/production-action/fx/resolveActionDepositInputFx.ts#L91). Admission checks the remaining charge budget but does not establish that final depletion can remove the payer.

**Trigger and actual behavior:** a consumer requests the last charge of a neighboring Deposit. That Deposit owns a queued line waiting for missing material. At queue dispatch, the charge plan admits the Deposit. [src/production-action/fx/spendActionChargesFx.ts:126](https://github.com/marek-hanzal/arkini/blob/696a4a2b3d194f13e53c04a99bf3f4f0f7f921f1/src/production-action/fx/spendActionChargesFx.ts#L126) tries to remove its identity; identity protection rejects the queued owner with `JobOwnerBusyError`. This escapes the recoverable rejection handling in [src/production-job/fx/attemptQueuedLineStartFx.ts:118](https://github.com/marek-hanzal/arkini/blob/696a4a2b3d194f13e53c04a99bf3f4f0f7f921f1/src/production-job/fx/attemptQueuedLineStartFx.ts#L118).

**Impact:** the complete Tick rolls back, including independent production. The real production loop reports fatal source `tick`; the session becomes `frozen`, and even a subsequent clear-queue command fails with `GameSessionNotRunningError`. A valid saved state can hydrate successfully and hit this failure on its first Tick.

**Contract:** GAME.MD lines 28, 32, 64 and 76: blocked intent retries against fresh facts; start is atomic; payer ownership must remain valid; a blocked owner does not prevent independent owners from advancing.

**Proof:** two engine tests use schema- and semantic-validator-approved synthetic config and real spawn/enqueue operations. One proves the exact error and total rollback, then recovery when the queue is cleared before the failing Tick. The other serializes that legal state and starts a real game session, proving fatal Tick and rejection of subsequent commands. The coordinating reviewer reran both successfully.

**Required behavior:** charge admission must account for final aggregated spend and payer removability, continue to later eligible candidates, and preserve unrelated Tick progress when no eligible payer exists. Catching `JobOwnerBusyError` alone would leave the first ineligible target masking alternatives.

## P1 — old MCP checkout discards another project's new draft

**Location:** [src/project-version/fx/checkoutProjectVersionFx.ts:73](https://github.com/marek-hanzal/arkini/blob/696a4a2b3d194f13e53c04a99bf3f4f0f7f921f1/src/project-version/fx/checkoutProjectVersionFx.ts#L73) and [src/authoring-mcp/fx/bootstrapEditorMcpVersionCheckoutFx.ts:40](https://github.com/marek-hanzal/arkini/blob/696a4a2b3d194f13e53c04a99bf3f4f0f7f921f1/src/authoring-mcp/fx/bootstrapEditorMcpVersionCheckoutFx.ts#L40). The MCP callback checks the open project only before awaiting checkout; the coordinator later calls the process-wide `discardAllFn`, synchronizes the old project's Board and the callback navigates back to the old project.

**Trigger and actual behavior:** start MCP checkout of project A while its screen is clean, delay asynchronous Board release, navigate to project B, and type into a B draft. Complete A's pending checkout. B's draft receives Discard; the route returns to A's Version history and Board synchronization targets A.

**Impact:** unsaved work in a different project is lost under a discard authorization that belonged to A. The current navigation guard does not prevent this sequence: [src/authoring-shell/ui/useEditorNavigationBlocker.ts:17](https://github.com/marek-hanzal/arkini/blob/696a4a2b3d194f13e53c04a99bf3f4f0f7f921f1/src/authoring-shell/ui/useEditorNavigationBlocker.ts#L17) guards dirty sessions, while ProjectWriteAdmission guards repository writes/replacements. Actual project route enter/leave hooks start Board work asynchronously without blocking navigation.

**Contract:** project-scoped MCP operations and explicit whole-project replacement own only their admitted project/session. The terminal checkout handshake must not acquire authority over a successor's drafts, route, or Board.

**Proof:** actual TanStack memory router, production navigation blocker, real UnsavedChanges owner and registration, native input, real MCP bootstrap and checkout coordinator; mocks only external repository/Board capabilities. Observed `discarded: 1`, route `/editor/project-one/versions/history`, Board synchronization `project-one` after editing project two. The coordinating reviewer independently checked route admission and the complete coordinator, then reran the final probe. An initial harness timeout was discarded; the final probe uses synchronous live dirty state matching TanStack reset, has no artificial IPC delay, and fails only on the incorrect discard assertion.

**Required behavior:** explicitly retain replacement lifecycle ownership across awaits, and scope draft destruction and renderer settlement to the admitted session/project. A completed durable checkout must not discard or redirect an unrelated successor.

The adjacent refresh operation at [src/authoring-session/fx/refreshEditorProjectFx.ts:58](https://github.com/marek-hanzal/arkini/blob/696a4a2b3d194f13e53c04a99bf3f4f0f7f921f1/src/authoring-session/fx/refreshEditorProjectFx.ts#L58) has the same unscoped discard/sync sequence. That extension is a structural observation, not a second independently reproduced finding.

## P1 — delayed scenario restore replaces a successor Board

**Location:** [src/board-scenario/fx/createEditorBoardGameResourceFx.ts:130](https://github.com/marek-hanzal/arkini/blob/696a4a2b3d194f13e53c04a99bf3f4f0f7f921f1/src/board-scenario/fx/createEditorBoardGameResourceFx.ts#L130). Replacement validates only project ID and revision. The initiating [src/board-scenario/fx/restoreBoardScenarioFx.ts:44](https://github.com/marek-hanzal/arkini/blob/696a4a2b3d194f13e53c04a99bf3f4f0f7f921f1/src/board-scenario/fx/restoreBoardScenarioFx.ts#L44) awaits repository I/O before replacing the currently owned game at line 75.

**Trigger and actual behavior:** start Load, leave the Editor before the read completes, and reopen the same unchanged project. The new Board has the same project ID/revision. Completion of the old restore passes validation, disposes that new Board, and installs the old request's scenario.

**Impact:** the successor Board's in-progress state is destroyed by an operation from an abandoned session.

**Contract:** exact ownership of one ephemeral Board lifecycle; stale completion must not replace its successor. Project revision is an authored-data identity, not a live game/session identity.

**Proof:** real toolbar hook, real Command Atoms, restore operation and serialized Board owner; only repository read and resource creation are controlled. The Atom Promise subscription demonstrably survives toolbar unmount. Expected-red test fails because the successor owner snapshot is replaced. The coordinating reviewer independently reran it and traced actual route release/reentry.

**Required behavior:** capture and verify the originating live session/request identity at replacement, including same-project/same-revision reentry. Preserve existing rejection for release and newer revisions.

## P2 — concurrent UI commands receive another command's result

**Location:** [src/tile-interaction/atom/runSpaceActivationAtom.ts:25](https://github.com/marek-hanzal/arkini/blob/696a4a2b3d194f13e53c04a99bf3f4f0f7f921f1/src/tile-interaction/atom/runSpaceActivationAtom.ts#L25) and [src/tile-interaction/atom/runTileDropAtom.ts:23](https://github.com/marek-hanzal/arkini/blob/696a4a2b3d194f13e53c04a99bf3f4f0f7f921f1/src/tile-interaction/atom/runTileDropAtom.ts#L23). Each exact Game owns one concurrent Atom; consumers use `useAtomSet` in promise mode as though each Promise represented its individual command.

**Actual behavior:** the installed Atom hook writes to the Atom and awaits its shared result; concurrent Atom execution aggregates active fibers. There is no command-result identity in that promise adapter. Execution concurrency is preserved, but settlement identity is not.

**Impact and proof:** real hook + real engine tests hold a legal Runtime transaction while submitting two commands. With one rejected and one accepted Space activation, the engine reaches Space 7 but both callers receive `null`. A real PixiInventorySurface hook test then proves that the accepted transition is neither projected nor followed by return to Board. With two different item moves, canonical positions both update correctly, but both Promises return the first actor's Move result. This violates the exact result seam consumed by drag settlement.

**Contract:** the exact admitted engine command/result crosses the UI seam; presentation follows its committed facts. Production drag admission allows another actor after release while the first result is pending, so this is reachable concurrency rather than forbidden reentrancy.

**Required behavior:** every submission must settle with its own result/failure while preserving independent command execution. Audit sibling concurrent promise adapters, including inventory release, without claiming separately tested effects for unprobed siblings.

## P2 — Save loses edits entered while persistence is pending

**Location:** [src/item-authoring/ui/useFormController.ts:225](https://github.com/marek-hanzal/arkini/blob/696a4a2b3d194f13e53c04a99bf3f4f0f7f921f1/src/item-authoring/ui/useFormController.ts#L225) and [src/project-authoring/ui/useProjectFormController.ts:220](https://github.com/marek-hanzal/arkini/blob/696a4a2b3d194f13e53c04a99bf3f4f0f7f921f1/src/project-authoring/ui/useProjectFormController.ts#L220). After await, both controllers reset to the submitted snapshot and invoke navigation without checking whether editing continued.

**Trigger and actual behavior:** edit a title, click Save, and type a newer title before persistence completes. Fields remain enabled; only Save/Discard actions are disabled by [src/editor-control/ui/EditorFormSectionPage.tsx:28](https://github.com/marek-hanzal/arkini/blob/696a4a2b3d194f13e53c04a99bf3f4f0f7f921f1/src/editor-control/ui/EditorFormSectionPage.tsx#L28). When the earlier save finishes, the newer draft is reset and the form navigates away.

**Impact:** permitted post-submission edits disappear without being saved or covered by another leave decision. The persisted earlier snapshot is correct; the loss concerns the newer local draft.

**Contract:** the form owns its local unsaved lifecycle; completion of one saved snapshot cannot silently discard later accepted editing.

**Proof:** two actual Form/TanStack/native-input probes, one Item and one Project. Persistence is gated; the submitted canonical data is republished before promise completion to match real save ordering. Each test observes the later title replaced by the submitted title and one navigation. Expected-red assertions fail on that lost later edit. Independent reviewer checked admission and ordering.

**Required behavior:** prevent editing for the pending save lifecycle, or preserve the newer draft and suppress departure when the completed save no longer covers it. Use the smallest consistent policy across Item and Project forms.

## Validation and limits

- Existing UI/interaction/detail/menu/build/flow suites: **22 files / 89 tests passed**. Command: `argc test test/tile-interaction/atom test/game-scene/ui test/item-detail-frame test/game-menu test/editor-build test/flow-layout`.
- Existing Item/Project forms and Board operations: **22 files / 59 tests passed**. Command: `argc test test/item-authoring/ui test/project-authoring/ui test/board-scenario/fx`.
- Agent Board/checkout/refresh/replacement suites: **8 files / 22 tests passed**. These overlap the groups above; totals are not summed.
- Engine affected suites: **13 files / 54 tests passed**, including the two tests asserting the broken current behavior. The coordinating reviewer independently reran those two.
- Independent reviewer reran the two existing MCP/checkout suites (**5 tests passed**) alongside three expected-red MCP/Atom probes.
- Audit finished with a clean worktree; document-only publication is validated separately with `git diff --check`.
- Expected-red probes cover the missing result isolation, editor save settlement, successor Board restore and MCP lifecycle guarantees; archived outside the repo.
- No full `argc check`, build/package/platform gate, hosted CI or native visual preview was run for this read-only audit. jsdom/Pixi fixture tests establish lifecycle and wiring, not native rendering appearance.
- No claim that every possible regression was exhausted. Checked engine boundaries include Tick dispatch/snapshots/completion/expiry, delivery, job/charge admission, output reservations, reserved-material release, passive-storage gating and hydration. MCP review also traced normal project/Notes invalidation and listener ownership.

## Rejected candidates

- Inventory Escape/menu drag continuation: initial harness omitted PlayableInventory's capture-phase Escape navigation; actual route intercepts the event first. Its red probe is excluded from findings.
- Board ItemDetail surviving resource replacement: actual route/resource probe demonstrated shell unmount between sessions; excluded.
- Old Board save against a newer project or restore after plain release/newer revision: existing route/revision guards reject these cases. The reported Board bug requires same-project/same-revision reentry.
- Tick wording about newly admitted work receiving time: existing executable step-start behavior already covers this; ambiguous wording was not promoted into a bug.

No production, game-data, architecture, or test changes are included. This is a dated evidence snapshot against the pinned baseline, not an active architecture contract or a replacement for issue tracking.
