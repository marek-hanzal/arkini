import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readItemDetailTabsFx } from "~/engine/item-detail/read/readItemDetailTabsFx";
import { resolveItemDetailTargetFx } from "~/engine/item-detail/read/resolveItemDetailTargetFx";
import { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { lineRunRuntime, lineRunTestConfig } from "~test/line/fx/run/support/lineRunTestRuntime";
import { purityTestConfig } from "~test/line/support/purityTestConfig";

const sourceProjection = {
	kind: "available",
	itemId: "runtime:workshop",
	targetDefinitionItemId: "water",
	source: [
		{
			ownerItemId: "runtime:source",
			ownerDefinitionItemId: "workshop",
			space: 0,
			line: [],
		},
	],
} as const;

describe("resolveItemDetailTargetFx", () => {
	it("exposes Queue for every runtime line-owner variant", () => {
		const lineOwners = [
			lineRunTestConfig.items.workshop,
			{
				...purityTestConfig.items.craft,
				type: "blueprint" as const,
			},
			purityTestConfig.items.craft,
			purityTestConfig.items.stash,
		];
		for (const [index, item] of lineOwners.entries()) {
			const runtimeItem = RuntimeItemSchema.parse({
				id: `runtime:line-owner:${index}`,
				item,
				location: {
					scope: "board",
					space: 0,
					position: {
						x: index,
						y: 0,
					},
				},
				quantity: 1,
				revision: `revision:${index}`,
			});
			expect(
				Effect.runSync(
					readItemDetailTabsFx({
						target: {
							kind: "runtime",
							item: runtimeItem,
						},
					}),
				),
			).toEqual([
				"lines",
				"queue",
				"info",
			]);
		}
	});

	it("exposes one finite authoritative tab set and validates requested tabs", () => {
		const runtime = lineRunRuntime({});
		expect(
			Effect.runSync(
				readItemDetailTabsFx({
					target: {
						kind: "runtime",
						item: runtime.items[0],
					},
				}),
			),
		).toEqual([
			"lines",
			"queue",
			"info",
		]);
		expect(
			Effect.runSync(
				readItemDetailTabsFx({
					target: {
						kind: "runtime",
						item: runtime.items[0],
					},
					sources: sourceProjection,
				}),
			),
		).toEqual([
			"lines",
			"queue",
			"sources",
			"info",
		]);
		expect(
			Effect.runSync(
				resolveItemDetailTargetFx({
					itemId: "runtime:workshop",
					runtime,
				}),
			),
		).toMatchObject({
			kind: "available",
			itemId: "runtime:workshop",
			tab: "lines",
		});
		expect(
			Effect.runSync(
				resolveItemDetailTargetFx({
					itemId: "runtime:workshop",
					requestedTab: "queue",
					runtime,
				}),
			),
		).toMatchObject({
			kind: "available",
			itemId: "runtime:workshop",
			tab: "queue",
		});
		expect(
			Effect.runSync(
				resolveItemDetailTargetFx({
					itemId: "runtime:workshop",
					requestedTab: "sources",
					runtime,
					sources: sourceProjection,
				}),
			),
		).toMatchObject({
			kind: "available",
			itemId: "runtime:workshop",
			tab: "sources",
		});
	});

	it("defaults source-only items to Sources while keeping Info as the unsupported-tab fallback", () => {
		const runtime = lineRunRuntime({});
		const ordinaryRuntime = {
			...runtime,
			items: [
				{
					...runtime.items[0],
					item: lineRunTestConfig.items.water,
				},
			],
		};
		expect(
			Effect.runSync(
				readItemDetailTabsFx({
					target: {
						kind: "runtime",
						item: ordinaryRuntime.items[0],
					},
					sources: sourceProjection,
				}),
			),
		).toEqual([
			"sources",
			"info",
		]);
		expect(
			Effect.runSync(
				readItemDetailTabsFx({
					target: {
						kind: "definition",
					},
					sources: sourceProjection,
				}),
			),
		).toEqual([
			"sources",
			"info",
		]);
		expect(
			Effect.runSync(
				resolveItemDetailTargetFx({
					itemId: "runtime:workshop",
					runtime: ordinaryRuntime,
					sources: sourceProjection,
				}),
			),
		).toEqual({
			kind: "available",
			itemId: "runtime:workshop",
			tab: "sources",
			tabs: [
				"sources",
				"info",
			],
		});
		expect(
			Effect.runSync(
				resolveItemDetailTargetFx({
					itemId: "runtime:workshop",
					requestedTab: "lines",
					runtime: ordinaryRuntime,
				}),
			),
		).toEqual({
			kind: "available",
			itemId: "runtime:workshop",
			tab: "info",
			tabs: [
				"info",
			],
		});
		expect(
			Effect.runSync(
				resolveItemDetailTargetFx({
					itemId: "runtime:missing",
					requestedTab: "info",
					runtime,
				}),
			),
		).toEqual({
			kind: "unavailable",
		});
	});
});
