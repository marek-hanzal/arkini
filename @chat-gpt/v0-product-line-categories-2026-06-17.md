# v0 product line categories follow-up

Status: TODO
Created: 2026-06-17

## Context

`GameConfigSchema` now treats producer products as ordered production lines. This gives the engine a clean mechanic, but the UI will eventually need a better way to present many lines on one producer without turning the sheet into a scrollable spreadsheet pretending to be a game.

This is not implemented yet. Do not add category fields to the config until we decide the actual UI/use case.

## Problem to discuss

A producer may eventually expose several product lines:

- always-available basic lines.
- lines unlocked by passive requirements, e.g. knowledge/license/specialist item.
- lines that act as sinks/destructors.
- lines that are advanced variants of a cheaper/basic process.
- lines that share inputs and therefore need player-facing priority/toggle controls.

Plain `productIds` order is enough for runtime priority, but it may not be enough for player comprehension.

## Candidate config additions

Possible product-line metadata, if UI proves it needs them:

```json
{
	"products": {
		"product:lumber-camp.saw": {
			"name": "Saw logs",
			"categoryId": "product-category:wood.advanced",
			"sort": 20
		}
	}
}
```

Possible top-level categories:

```json
{
	"productCategories": {
		"product-category:wood.basic": {
			"name": "Basic",
			"sort": 10
		},
		"product-category:wood.advanced": {
			"name": "Advanced",
			"sort": 20
		}
	}
}
```

Alternative: keep categories entirely UI-derived from product order, tags or requirements. This is less config, but weaker authoring control.

## Open questions

- Are categories global, producer-local, or just UI sections inside a producer detail sheet?
- Should categories affect only rendering, or also default priority/toggle behavior?
- Do we need per-product `description`/`iconAssetId`/`sort` before categories?
- Should hidden/locked product lines be visible with unmet requirements, or fully invisible until unlocked?
- Is a category ID worth it, or is simple `group: string` enough for v0?

## Current decision

Leave product lines enabled by default and ordered by `producers.*.productIds`. Do not add authored categories until we design the production line UI. The current schema remains mechanic-first, not UI-catalog-first, because nobody needs a tiny ERP system glued to a merge board yet.
