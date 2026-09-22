import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { fromStateFx } from "~/game-persistence/fx/fromStateFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import {
	runCraft,
	spawnCraftFx,
} from "~test/production-job/fx/completeJobTransitionFx.craft.test/fixture";

describe("craft completion recovery", () => {
	it("round-trips an active craft job and its reservation through persisted state", () => {
		const result = runCraft(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemId: "craft:reserve",
				});
				const tool = yield* spawnItemFx({
					id: "runtime:roundtrip-tool",
					itemId: "item:tool",
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
					lineId: "line:craft:reserve",
					inputIndex: 0,
					sourceItemId: tool.id,
					sourceItemRevision: tool.revision,
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:craft:reserve",
				});
				const runtime = yield* readRuntimeFx();
				const state = fromRuntimeFn({
					runtime,
				});
				const restored = yield* fromStateFx({
					state,
				});
				return {
					restored,
					runtime,
					state,
				};
			}),
		);

		expect(result.restored.jobs).toEqual(result.runtime.jobs);
		expect(result.restored.jobQueue).toEqual(result.runtime.jobQueue);
		expect(result.restored.items.map((item) => item.location)).toEqual(
			result.runtime.items.map((item) => item.location),
		);
		expect(result.state.items.some((item) => item.location.scope === "reserved")).toBe(true);
	});
});
