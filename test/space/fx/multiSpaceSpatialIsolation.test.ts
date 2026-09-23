import { makeFixedRandomFx } from "~test/support/makeFixedRandomFx";
import { Effect, Result, Random } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { resolveLineRunFx } from "~/production-line/fx/resolveLineRunFx";
import { mergeItemsFx } from "~/item-merge/fx/mergeItemsFx";
import { queryFx } from "~/item-query/fx/queryFx";
import { checkRuntimeFx } from "~/game-runtime/fx/checkRuntimeFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { DropItemRejectedReason, DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import { dropItemFx } from "~/item-interaction/fx/dropItemFx";
import { boardLocation, multiSpaceTestConfig } from "~test/space/support/multiSpaceTestConfig";
import { placeDropForTestFx } from "~test/item-placement/support/placeDropForTestFx";

const useTestGame = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	effect.pipe(
		useGameFx({
			config: multiSpaceTestConfig,
		}),
	);

const drop = (placement: "drop" | "random", quantity = 1) => ({
	type: "item" as const,
	itemUid: "log",
	placement,
	quantity: {
		min: quantity,
		max: quantity,
	},
	rules: [],
});

describe("multi-space spatial isolation", () => {
	it("treats space plus coordinates as one board-cell identity", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const first = yield* spawnItemFx({
					id: "runtime:first",
					itemUid: "log",
					location: boardLocation(0, 1),
				});
				const second = yield* spawnItemFx({
					id: "runtime:second",
					itemUid: "log",
					location: boardLocation(1, 1),
				});
				const runtime = yield* readRuntimeFx();
				const checked = yield* checkRuntimeFx({
					runtime,
				});

				return {
					checked,
					first,
					second,
				};
			}).pipe(useTestGame),
		);

		expect(result.checked.issues).toEqual([]);
		expect(result.first.id).toBe("runtime:first");
		expect(result.second.id).toBe("runtime:second");
	});

	it("keeps far queries local to their origin space", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* spawnItemFx({
					id: "runtime:origin",
					itemUid: "origin",
					location: boardLocation(1, 0),
				});
				yield* spawnItemFx({
					id: "runtime:local",
					itemUid: "log",
					location: boardLocation(1, 1),
				});
				yield* spawnItemFx({
					id: "runtime:remote",
					itemUid: "log",
					location: boardLocation(0, 1),
				});
				if (origin.location.scope !== "board") {
					return yield* Effect.die(new Error("Expected board origin."));
				}

				const board = yield* queryFx({
					origin: origin.location,
					query: {
						distance: "far",
						selector: {
							type: "item",
							itemUid: "log",
						},
					},
				});

				return {
					board: board.map((item) => item.id),
				};
			}).pipe(useTestGame),
		);

		expect(result.board).toEqual([
			"runtime:local",
		]);
	});

	it("keeps external unit targets inside the owner space", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:units-owner",
					itemUid: "unitsProducer",
					location: boardLocation(1, 0),
				});
				yield* spawnItemFx({
					id: "runtime:remote-payer",
					itemUid: "payer",
					location: boardLocation(0, 1),
				});
				const remoteOnly = yield* resolveLineRunFx({
					ownerItemId: owner.id,
					lineId: "line:units:run",
					runtime: yield* readRuntimeFx(),
				});
				yield* spawnItemFx({
					id: "runtime:local-payer",
					itemUid: "payer",
					location: boardLocation(1, 1),
				});
				const local = yield* resolveLineRunFx({
					ownerItemId: owner.id,
					lineId: "line:units:run",
					runtime: yield* readRuntimeFx(),
				});

				return {
					local,
					remoteOnly,
				};
			}).pipe(useTestGame),
		);

		expect(result.remoteOnly.ready).toBe(false);
		expect(result.local.ready).toBe(true);
	});

	it("places new identities and random origins only in the origin space", () => {
		const placed = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* spawnItemFx({
					id: "runtime:origin",
					itemUid: "origin",
					location: boardLocation(1, 0),
				});
				yield* spawnItemFx({
					id: "runtime:local-item",
					itemUid: "log",
					location: boardLocation(1, 1),
				});
				yield* spawnItemFx({
					id: "runtime:remote-item",
					itemUid: "log",
					location: boardLocation(0, 1),
				});
				yield* placeDropForTestFx({
					drop: drop("drop", 1),
					originItemId: origin.id,
				});
				return yield* readRuntimeFx();
			}).pipe(useTestGame),
		);
		expect(
			placed.items.some(
				(item) =>
					item.item.uid === "log" &&
					item.location.scope === "board" &&
					item.location.space === 1 &&
					item.location.position.x === 2,
			),
		).toBe(true);

		const randomized = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* spawnItemFx({
					id: "runtime:random-origin",
					itemUid: "origin",
					location: boardLocation(4, 0),
				});
				yield* placeDropForTestFx({
					drop: drop("random"),
					originItemId: origin.id,
				});
				return yield* readRuntimeFx();
			}).pipe(
				Effect.provideServiceEffect(
					Random.Random,
					makeFixedRandomFx([
						0.75,
					]),
				),
				useTestGame,
			),
		);

		expect(
			randomized.items
				.filter((item) => item.item.uid === "log" && item.location.scope === "board")
				.every((item) => item.location.scope === "board" && item.location.space === 4),
		).toBe(true);
	});

	it("rejects output on a full Board instead of spilling into another space", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* spawnItemFx({
					id: "runtime:origin",
					itemUid: "origin",
					location: boardLocation(2, 0),
				});
				for (const x of [
					1,
					2,
				]) {
					yield* spawnItemFx({
						id: `runtime:blocker:${x}`,
						itemUid: "blocker",
						location: boardLocation(2, x),
					});
				}
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(
					placeDropForTestFx({
						drop: drop("drop"),
						originItemId: origin.id,
					}),
				);
				return {
					before,
					after: yield* readRuntimeFx(),
					attempt,
				};
			}).pipe(useTestGame),
		);

		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isFailure(result.attempt))
			expect(result.attempt.failure).toMatchObject({
				_tag: "PlacementUnavailableError",
			});
		expect(result.after).toEqual(result.before);
	});

	it("rejects every direct cross-space board operation atomically", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const movable = yield* spawnItemFx({
					id: "runtime:movable",
					itemUid: "log",
					location: boardLocation(0, 0),
				});
				const remote = yield* spawnItemFx({
					id: "runtime:remote",
					itemUid: "blocker",
					location: boardLocation(1, 1),
				});
				const source = yield* spawnItemFx({
					id: "runtime:merge-source",
					itemUid: "mergeSource",
					location: boardLocation(0, 2),
				});
				const target = yield* spawnItemFx({
					id: "runtime:merge-target",
					itemUid: "mergeTarget",
					location: boardLocation(1, 2),
				});
				const owner = yield* spawnItemFx({
					id: "runtime:workshop",
					itemUid: "workshop",
					location: boardLocation(1, 0),
				});

				const before = yield* readRuntimeFx();
				const moved = yield* dropItemFx({
					sourceItemId: movable.id,
					sourceRevision: movable.revision,
					sourceLocation: movable.location,
					target: {
						kind: "slot",
						location: owner.location,
						occupant: {
							itemId: owner.id,
							revision: owner.revision,
						},
					},
				});
				const swapped = yield* dropItemFx({
					sourceItemId: movable.id,
					sourceRevision: movable.revision,
					sourceLocation: movable.location,
					target: {
						kind: "slot",
						location: remote.location,
						occupant: {
							itemId: remote.id,
							revision: remote.revision,
						},
					},
				});
				const merged = yield* Effect.result(
					mergeItemsFx({
						sourceItemId: source.id,
						sourceRevision: source.revision,
						targetItemId: target.id,
						targetRevision: target.revision,
					}),
				);
				const stored = yield* Effect.result(
					storeInputMaterialFx({
						ownerItemId: owner.id,
						lineId: "line:workshop:material",
						inputIndex: 0,
						sourceItemId: movable.id,
						sourceItemRevision: movable.revision,
					}),
				);
				const after = yield* readRuntimeFx();

				return {
					after,
					before,
					merged,
					moved,
					stored,
					swapped,
				};
			}).pipe(useTestGame),
		);

		expect(result.moved).toMatchObject({
			kind: DropItemResultKind.Reject,
			reason: DropItemRejectedReason.InvalidTarget,
		});
		expect(result.swapped).toMatchObject({
			kind: DropItemResultKind.Reject,
			reason: DropItemRejectedReason.InvalidTarget,
		});
		expect(Result.isFailure(result.merged)).toBe(true);
		if (Result.isFailure(result.merged)) {
			expect(result.merged.failure).toMatchObject({
				_tag: "CrossSpaceBoardOperationError",
			});
		}
		expect(Result.isFailure(result.stored)).toBe(true);
		if (Result.isFailure(result.stored)) {
			expect(result.stored.failure).toMatchObject({
				_tag: "CrossSpaceBoardOperationError",
			});
		}
		expect(result.after).toEqual(result.before);
	});
});
