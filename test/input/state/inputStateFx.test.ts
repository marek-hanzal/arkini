import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { storeInputMaterialFx } from "~/engine/input/write/storeInputMaterialFx";
import { fromStateFx } from "~/engine/runtime/fx/fromStateFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { fromRuntimeFx } from "~/engine/state/fx/fromRuntimeFx";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/input/support/inputRuntimeTestConfig";

describe("input state", () => {
	it("round-trips buffered input locations without changing the runtime model", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:workshop",
					itemId: "workshop",
					location: workshopLocation,
					quantity: 1,
				});
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation(1),
					quantity: 2,
				});
				yield* storeInputMaterialFx({
					ownerItemId: "runtime:workshop",
					lineId: "line:workshop:build",
					inputIndex: 0,
					sourceItemId: "runtime:water",
					sourceItemRevision: source.revision,
					quantity: 2,
				});

				const runtime = yield* readRuntimeFx();
				const state = yield* fromRuntimeFx({
					runtime,
				});
				const restored = yield* fromStateFx({
					state,
				});
				const restoredState = yield* fromRuntimeFx({
					runtime: restored,
				});

				return {
					restored,
					restoredState,
					runtime,
					state,
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(result.restoredState).toEqual(result.state);
		for (const item of result.runtime.items) {
			const restoredItem = result.restored.items.find(
				(candidate) => candidate.id === item.id,
			);
			expect(restoredItem?.revision).toMatch(/^revision:/);
			expect(restoredItem?.revision).not.toBe(item.revision);
		}
		expect(result.state.items[1]?.location).toEqual({
			scope: "input",
			ownerItemId: "runtime:workshop",
			lineId: "line:workshop:build",
			inputIndex: 0,
		});
	});
});
