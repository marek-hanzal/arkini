# Audit domain Effect boundaries

Status: TODO

## Goal

Make sure domain logic lives in Effect-backed roots or small pure helpers, not in components or oversized hooks.

## Current state

- Command routing uses Effect.
- Many persistence/domain roots exist under feature `fx` folders.
- Some hooks still coordinate too much behavior.

## Audit checklist

- Components should not decide merge/feed/activation/craft eligibility.
- Hooks may compose Fx calls and UI state, but should not become domain engines.
- Domain Fx roots should return typed result schemas and visual events where relevant.
- Database writes should be inside transactions for all multi-step game changes.
- Shared helpers should be meaningful, not one-line shrine files.

## Acceptance

- Move remaining domain decisions out of UI components.
- Split only oversized hooks with multiple responsibilities.
- Keep one file per exported function/schema/type where practical.
- Typecheck and build pass.

## Watchouts

- Do not create abstract factories just to feel clever. Future us has enough enemies.
