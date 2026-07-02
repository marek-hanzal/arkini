# Pure vs Effect boundary audit

## Why

Codebase currently mixes pure domain helpers with Effect programs. The mix is not inherently bad, but it becomes expensive when pure helpers hide business decisions that are later revalidated differently by Effect code.

## Goal

Audit domain logic and tighten the boundary:

- Pure functions may do deterministic derivation, planning, matching, grouping, normalization, and readonly DTO/view shaping.
- Effect programs own runtime decisions that need services, config/save context, time, random, storage, domain errors, mutations, or emitted events.
- If a pure planner decides what interaction should happen, UI and runtime dispatch should share that planner instead of duplicating logic.
- Schema/config/save invariants stay centralized in schema validation, not scattered as random helpers.

## What to inspect

- `src/**/logic/**`
- `src/**/planning/**`
- `src/**/read*/**`
- `src/**/resolve*/**`
- `src/**/match*/**`
- pure helpers imported by `fx/` modules
- duplicated readiness/apply/UI planning paths

## Output

Produce a small report first. Do not rewrite immediately.

For each suspect area, classify it as:

- keep pure
- convert to Effect
- keep pure but move/rename/split
- replace duplicate helper with shared planner
- move invariant into schema validation

## Guardrails

- Do not convert everything to Effect by dogma.
- Do not leave business-critical decisions duplicated across pure and Effect layers.
- Prefer `ts-pattern` for discriminated union dispatch and exhaustive matching.
- Keep helpers small and named by the exact domain decision they make.
