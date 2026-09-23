import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readItemDetailLinesFx } from "~/item-line-detail/fx/readItemDetailLinesFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { runBlueprint } from "~test/production-job/fx/completeJobTransitionFx.blueprint.test/fixture";

describe("blueprint depletion projection", () => {
	it("keeps an input-starved net self-replacement available for preparation", () => {
		const result = runBlueprint(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:target",
					itemUid: "item:target",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
				});
				const owner = yield* spawnItemFx({
					id: "runtime:recycler",
					itemUid: "producer:recycler",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				return yield* readItemDetailLinesFx({
					itemId: owner.id,
					runtime: yield* readRuntimeFx(),
				});
			}),
		);

		expect(result).toMatchObject({
			kind: "available",
			line: [
				{
					availability: {
						kind: "available",
						readiness: "inputs",
					},
					actions: {},
				},
			],
		});
	});
});
