import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { isItemPureFx } from "~/v1/item/fx/purity/isItemPureFx";
import { storeInputMaterialFx } from "~/v1/input/write/storeInputMaterialFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { purityTestConfig } from "~test/line/support/purityTestConfig";

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
					ownerPure: yield* isItemPureFx({
						item: isolatedOwner,
						runtime,
					}),
					remainder,
					remainderPure: yield* isItemPureFx({
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
