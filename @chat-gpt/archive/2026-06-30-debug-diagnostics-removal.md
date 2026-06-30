# Debug diagnostics removal

Removed the obsolete dev diagnostics/debugger layer while preserving the cheat inventory testing utility.

Changes:
- Deleted `src/v0/diagnostics/DebugTimeline.ts` and the dev globals it exposed.
- Deleted `src/v0/debug/DebugBugReport.ts` and removed PlayShell registration/context plumbing.
- Removed TileEngine and runtime visual `DebugTimeline.record(...)` instrumentation.
- Deleted the actor/slot feedback debug hooks that only existed to emit timeline entries.
- Deleted the now-unused visual-plan summary helper.
- Updated README/current project notes so the old timeline is not documented as available.

Important: Cheat inventory remains available and still uses the existing cheat/debug spawn action path. Do not remove it when cleaning diagnostic code.
