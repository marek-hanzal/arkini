import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { storeInventoryItemFx } from "~/item-interaction/fx/storeInventoryItemFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { run, sourceLocation } from "../support/dropItemFixture";

describe("storeInventoryItemFx", () => {
	it("rejects a source from a formerly visible space without changing the runtime", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "source",
					itemId: "water",
					location: {
						...sourceLocation,
						space: 1,
					},
					quantity: 2,
				});
				const before = yield* readRuntimeFx();
				const stored = yield* storeInventoryItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: source.location,
				});
				return {
					before,
					after: yield* readRuntimeFx(),
					stored,
				};
			}),
		);
		expect(result.stored).toMatchObject({
			kind: "reject",
			reason: "invalid-target",
		});
		expect(result.after).toBe(result.before);
	});
	it("rolls back partial stack admission when Inventory cannot fit the whole source", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "source",
					itemId: "water",
					location: sourceLocation,
					quantity: 3,
				});
				for (let x = 0; x < 2; x++)
					yield* spawnItemFx({
						id: `stored:${x}`,
						itemId: "water",
						location: {
							scope: "inventory",
							position: {
								x,
								y: 0,
							},
						},
						quantity: 9,
					});
				const before = yield* readRuntimeFx();
				const stored = yield* storeInventoryItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: source.location,
				});
				return {
					before,
					after: yield* readRuntimeFx(),
					stored,
				};
			}),
		);
		expect(result.stored).toMatchObject({
			kind: "reject",
			reason: "blocked",
		});
		expect(result.after).toBe(result.before);
	});
});
