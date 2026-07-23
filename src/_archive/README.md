# Historical implementation oracle

This directory is outside every active source, test, formatter, bundler, and Dependency Cruiser root. Active code and tests may never import from it.

The tree is not production code and is not an architectural template. It may contain obsolete imports, types, tests, terminology, and rejected designs.

Consult an exact historical area only when a current GitHub issue explicitly requires parity evidence from it. [`@chat-gpt/tasks/COVERAGE.md`](../../@chat-gpt/tasks/COVERAGE.md) records the remaining owners; [#263](https://github.com/marek-hanzal/arkini/issues/263) and [#264](https://github.com/marek-hanzal/arkini/issues/264) own the final classification and pruning work.

Allowed oracle value is limited to player-visible behavior, UX and copy, edge cases and test scenarios, animation intent, and information required by public engine reads. Historical audio is rejected and its source has been removed; [#259](https://github.com/marek-hanzal/arkini/issues/259) starts from first principles. Do not copy historical save topology, timestamp scheduling, action buses, runtime mirrors, config compiler conventions, UI-owned gameplay decisions, or directory structure.

[#265](https://github.com/marek-hanzal/arkini/issues/265) owns final removal of this tree. Git history retains archaeology.
