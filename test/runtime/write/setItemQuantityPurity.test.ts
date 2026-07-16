import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { storeInputMaterialFx } from "~/engine/input/write/storeInputMaterialFx";
import { startLineFx } from "~/engine/job/write/startLineFx";
import { getItemFx } from "~/engine/runtime/read/getItemFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { setItemQuantityFx } from "~/engine/runtime/write/setItemQuantityFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { purityTestConfig } from "~test/line/support/purityTestConfig";

const board = (x: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y: 0,
	},
});

describe("setItemQuantityFx purity", () => {
	it("rejects generic quantity mutation of an active craft owner", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const craft = yield* spawnItemFx({
					id: "runtime:craft",
					itemId: "craft",
					location: board(0),
					quantity: 1,
				});
				const material = yield* spawnItemFx({
					id: "runtime:material",
					itemId: "material",
					location: board(1),
					quantity: 1,
				});
				yield* storeInputMaterialFx({
					ownerItemId: craft.id,
					lineId: "line:craft",
					inputIndex: 0,
					sourceItemId: material.id,
					sourceItemRevision: material.revision,
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: craft.id,
					lineId: "line:craft",
				});
				const activeCraft = yield* getItemFx({
					itemId: craft.id,
				});
				const before = yield* readRuntimeFx();
				const quantity = yield* Effect.either(
					setItemQuantityFx({
						itemId: activeCraft.id,
						quantity: 2,
						revision: activeCraft.revision,
					}),
				);
				const after = yield* readRuntimeFx();

				return {
					after,
					before,
					quantity,
				};
			}).pipe(
				useGameFx({
					config: purityTestConfig,
				}),
			),
		);

		expect(Either.isLeft(result.quantity)).toBe(true);
		if (Either.isLeft(result.quantity)) {
			expect(result.quantity.left).toMatchObject({
				_tag: "ItemStatefulError",
				itemId: "runtime:craft",
			});
		}
		expect(result.after).toEqual(result.before);
	});
});
