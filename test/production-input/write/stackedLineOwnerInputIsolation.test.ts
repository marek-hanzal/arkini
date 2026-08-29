import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { isItemPureFn } from "~/engine/item/fn/isItemPureFn";
import { storeInputMaterialFx } from "~/production-input/write/storeInputMaterialFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { purityTestConfig } from "~test/production-line/support/purityTestConfig";

describe("stacked line owner input isolation", () => {
	it.each([
		{
			itemId: "craft" as const,
			lineId: "line:craft",
		},
		{
			itemId: "stash" as const,
			lineId: "line:stash",
		},
	])("isolates one $itemId before attaching its first input", ({ itemId, lineId }) => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: `runtime:${itemId}`,
					itemId,
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 2,
				});
				const material = yield* spawnItemFx({
					id: `runtime:${itemId}:material`,
					itemId: "material",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				});
				yield* storeInputMaterialFx({
					ownerItemId: owner.id,
					lineId,
					inputIndex: 0,
					sourceItemId: material.id,
					sourceItemRevision: material.revision,
					quantity: 1,
				});
				const runtime = yield* readRuntimeFx();
				const isolatedOwner = runtime.items.find((item) => item.id === owner.id);
				const remainder = runtime.items.find(
					(item) => item.item.id === itemId && item.id !== owner.id,
				);
				if (isolatedOwner === undefined || remainder === undefined) {
					throw new Error(`Expected isolated ${itemId} owner and remainder.`);
				}

				return {
					isolatedOwner,
					ownerPure: isItemPureFn({
						item: isolatedOwner,
						runtime,
					}),
					remainder,
					remainderPure: isItemPureFn({
						item: remainder,
						runtime,
					}),
				};
			}).pipe(
				useGameFx({
					config: purityTestConfig,
				}),
			),
		);

		expect(result.isolatedOwner.quantity).toBe(1);
		expect(result.ownerPure).toBe(false);
		expect(result.remainder).toMatchObject({
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 1,
					y: 0,
				},
			},
			quantity: 1,
		});
		expect(result.remainderPure).toBe(true);
	});
});
