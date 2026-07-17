# Source-text policy cleanup

Issue: #240 follow-up

The first architecture-enforcement pass correctly removed `test/architecture`, but convention tests remained elsewhere. The follow-up removed the remaining tests whose only purpose was to preserve source spelling or current implementation structure:

- desktop builder YAML string assertions;
- recursive job timing name/source scans;
- recursive runtime transaction/import source scans;
- Canvas CSS-source and Tailwind-class assertions.

UI tests now retain only observable rendered contracts. Board tests prove canonical cell count and item placement, not internal wrapper names, copy, custom properties, or historical fixed-size absence. Appearance tests prove supported values, selection, and disabled behavior without freezing labels.

The one stable runtime import boundary from the deleted scanner moved to Dependency Cruiser: `RuntimeStoreFx` may be imported only by `GameCoreLayerFx`, `makeRuntimeStoreFx`, and `modifyRuntimeFx`. Runtime mutation correctness, revisions, timing, and lifecycle remain covered through behavior tests and the engine's schema/runtime validation rather than source-text recurrence tests.

`ArkiniProtocolError` is now an allowed Effect `Data.TaggedError` declaration instead of the last plain project-owned error class.

Do not recreate source scanners, exact UI-copy tests, CSS-spelling tests, implementation-call tests, or a custom AST policy framework. Coding grammar stays in `CODE_GUIDE.md` and review.
