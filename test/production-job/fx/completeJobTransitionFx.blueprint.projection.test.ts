import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readItemDetailLinesFx } from "~/item-line-detail/fx/readItemDetailLinesFx";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import {
	runBlueprint,
	spawnBlueprintFx,
} from "~test/production-job/fx/completeJobTransitionFx.blueprint.test/fixture";

describe("blueprint depletion projection", () => {
	it("keeps an input-starved net self-replacement available for preparation", () => {
		const result = runBlueprint(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:target",
					itemId: "item:target",
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
				const owner = yield* spawnItemFx({
					id: "runtime:recycler",
					itemId: "producer:recycler",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
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

	it("includes final-charge output and owner depletion in input-starved fallback", () => {
		const result = runBlueprint(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:depletion-product",
					itemId: "item:depletion-product",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 2,
							y: 0,
						},
					},
					quantity: 1,
				});
				const capped = yield* spawnBlueprintFx({
					id: "runtime:depletion-capped",
					space: 0,
					itemId: "blueprint:depletion-capped",
					x: 0,
					y: 0,
				});
				const self = yield* spawnBlueprintFx({
					id: "runtime:depletion-self",
					space: 0,
					itemId: "blueprint:depletion-self",
					x: 1,
					y: 0,
				});
				const runtime = yield* readRuntimeFx();
				return {
					capped: yield* readItemDetailLinesFx({
						itemId: capped.id,
						runtime,
					}),
					self: yield* readItemDetailLinesFx({
						itemId: self.id,
						runtime,
					}),
				};
			}),
		);

		expect(result.capped).toMatchObject({
			kind: "available",
			line: [
				{
					availability: {
						kind: "unavailable",
						reason: {
							kind: "direct-output-capacity",
							itemId: "item:depletion-product",
						},
					},
				},
			],
		});
		expect(result.self).toMatchObject({
			kind: "available",
			line: [
				{
					availability: {
						kind: "available",
						readiness: "inputs",
					},
				},
			],
		});
	});
});
