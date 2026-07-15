import { Effect, Either, Random } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { storeInputMaterialFx } from "~/v1/input/write/storeInputMaterialFx";
import { readLineRunFx } from "~/v1/line/fx/run/readLineRunFx";
import { mergeItemsFx } from "~/v1/merge/write/mergeItemsFx";
import { placeDropFx } from "~/v1/placement/write/placeDropFx";
import { queryFx } from "~/v1/query/fx/queryFx";
import { checkRuntimeFx } from "~/v1/runtime/check/checkRuntimeFx";
import { getItemAtFx } from "~/v1/runtime/read/getItemAtFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { moveItemFx } from "~/v1/runtime/write/moveItemFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { swapItemsFx } from "~/v1/runtime/write/swapItemsFx";
import { setCurrentSpaceFx } from "~/v1/space/write/setCurrentSpaceFx";
import {
	boardLocation,
	inventoryLocation,
	multiSpaceTestConfig,
} from "~test/space/support/multiSpaceTestConfig";

const useTestGame = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	effect.pipe(
		useGameFx({
			config: multiSpaceTestConfig,
		}),
	);

const drop = (placement: "drop" | "random", quantity = 1) => ({
	itemId: "log",
	placement,
	quantity: {
		type: "value" as const,
		value: quantity,
	},
	rules: [],
});

describe("multi-space spatial isolation", () => {
	it("treats space plus coordinates as one board-cell identity", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const first = yield* spawnItemFx({
					id: "runtime:first",
					itemId: "log",
					location: boardLocation(0, 1),
					quantity: 1,
				});
				const second = yield* spawnItemFx({
					id: "runtime:second",
					itemId: "log",
					location: boardLocation(1, 1),
					quantity: 1,
				});
				const runtime = yield* readRuntimeFx();
				const checked = yield* checkRuntimeFx({
					runtime,
				});

				return {
					checked,
					first: yield* getItemAtFx({
						location: first.location,
					}),
					second: yield* getItemAtFx({
						location: second.location,
					}),
				};
			}).pipe(useTestGame),
		);

		expect(result.checked.issues).toEqual([]);
		expect(result.first.id).toBe("runtime:first");
		expect(result.second.id).toBe("runtime:second");
	});

	it("keeps board and any queries local while inventory remains universe-wide", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* spawnItemFx({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(1, 0),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:local",
					itemId: "log",
					location: boardLocation(1, 1),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:remote",
					itemId: "log",
					location: boardLocation(0, 1),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:inventory",
					itemId: "log",
					location: inventoryLocation(0),
					quantity: 1,
				});
				if (origin.location.scope !== "board") {
					return yield* Effect.dieMessage("Expected board origin.");
				}

				const board = yield* queryFx({
					origin: origin.location,
					query: {
						scope: "board",
						distance: "far",
						selector: {
							type: "item",
							itemId: "log",
						},
					},
				});
				const any = yield* queryFx({
					origin: origin.location,
					query: {
						scope: "any",
						selector: {
							type: "item",
							itemId: "log",
						},
					},
				});

				return {
					any: any.map((item) => item.id),
					board: board.map((item) => item.id),
				};
			}).pipe(useTestGame),
		);

		expect(result.board).toEqual([
			"runtime:local",
		]);
		expect(result.any).toEqual([
			"runtime:local",
			"runtime:inventory",
		]);
	});

	it("keeps external charge targets inside the owner space", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:deposit-owner",
					itemId: "depositProducer",
					location: boardLocation(1, 0),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:remote-payer",
					itemId: "payer",
					location: boardLocation(0, 1),
					quantity: 1,
				});
				const remoteOnly = yield* readLineRunFx({
					ownerItemId: owner.id,
					lineId: "line:deposit:run",
				});
				yield* spawnItemFx({
					id: "runtime:local-payer",
					itemId: "payer",
					location: boardLocation(1, 1),
					quantity: 1,
				});
				const local = yield* readLineRunFx({
					ownerItemId: owner.id,
					lineId: "line:deposit:run",
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

	it("places stacks, spawns, and random origins only in the origin space", () => {
		const stacked = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* spawnItemFx({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(1, 0),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:local-stack",
					itemId: "log",
					location: boardLocation(1, 1),
					quantity: 2,
				});
				yield* spawnItemFx({
					id: "runtime:remote-stack",
					itemId: "log",
					location: boardLocation(0, 1),
					quantity: 2,
				});
				yield* placeDropFx({
					drop: drop("drop", 2),
					originItemId: origin.id,
				});
				return yield* readRuntimeFx();
			}).pipe(useTestGame),
		);

		expect(stacked.items.find((item) => item.id === "runtime:local-stack")?.quantity).toBe(3);
		expect(stacked.items.find((item) => item.id === "runtime:remote-stack")?.quantity).toBe(2);
		expect(
			stacked.items.some(
				(item) =>
					item.item.id === "log" &&
					item.location.scope === "board" &&
					item.location.space === 1 &&
					item.location.position.x === 2,
			),
		).toBe(true);

		const randomized = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* spawnItemFx({
					id: "runtime:random-origin",
					itemId: "origin",
					location: boardLocation(4, 0),
					quantity: 1,
				});
				yield* placeDropFx({
					drop: drop("random"),
					originItemId: origin.id,
				});
				return yield* readRuntimeFx();
			}).pipe(
				Effect.withRandom(
					Random.fixed([
						2,
					]),
				),
				useTestGame,
			),
		);

		expect(
			randomized.items
				.filter((item) => item.item.id === "log" && item.location.scope === "board")
				.every((item) => item.location.scope === "board" && item.location.space === 4),
		).toBe(true);
	});

	it("falls back to global inventory instead of another board space", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* spawnItemFx({
					id: "runtime:origin",
					itemId: "origin",
					location: boardLocation(2, 0),
					quantity: 1,
				});
				for (const x of [
					1,
					2,
				]) {
					yield* spawnItemFx({
						id: `runtime:blocker:${x}`,
						itemId: "blocker",
						location: boardLocation(2, x),
						quantity: 1,
					});
				}
				yield* placeDropFx({
					drop: drop("drop"),
					originItemId: origin.id,
				});
				return yield* readRuntimeFx();
			}).pipe(useTestGame),
		);

		expect(runtime.items.find((item) => item.item.id === "log")?.location).toEqual(
			inventoryLocation(0),
		);
	});

	it("rejects every direct cross-space board operation atomically", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const movable = yield* spawnItemFx({
					id: "runtime:movable",
					itemId: "log",
					location: boardLocation(0, 0),
					quantity: 1,
				});
				const remote = yield* spawnItemFx({
					id: "runtime:remote",
					itemId: "blocker",
					location: boardLocation(1, 1),
					quantity: 1,
				});
				const source = yield* spawnItemFx({
					id: "runtime:merge-source",
					itemId: "mergeSource",
					location: boardLocation(0, 2),
					quantity: 1,
				});
				const target = yield* spawnItemFx({
					id: "runtime:merge-target",
					itemId: "mergeTarget",
					location: boardLocation(1, 2),
					quantity: 1,
				});
				const owner = yield* spawnItemFx({
					id: "runtime:workshop",
					itemId: "workshop",
					location: boardLocation(1, 0),
					quantity: 1,
				});
				const inventory = yield* spawnItemFx({
					id: "runtime:inventory",
					itemId: "log",
					location: inventoryLocation(0),
					quantity: 1,
				});

				const before = yield* readRuntimeFx();
				const moved = yield* Effect.either(
					moveItemFx({
						itemId: movable.id,
						revision: movable.revision,
						location: boardLocation(1, 0),
					}),
				);
				const swapped = yield* Effect.either(
					swapItemsFx({
						firstItemId: movable.id,
						firstItemRevision: movable.revision,
						secondItemId: remote.id,
						secondItemRevision: remote.revision,
					}),
				);
				const inventorySwapped = yield* Effect.either(
					swapItemsFx({
						firstItemId: inventory.id,
						firstItemRevision: inventory.revision,
						secondItemId: remote.id,
						secondItemRevision: remote.revision,
					}),
				);
				const merged = yield* Effect.either(
					mergeItemsFx({
						sourceItemId: source.id,
						sourceRevision: source.revision,
						targetItemId: target.id,
						targetRevision: target.revision,
					}),
				);
				const stored = yield* Effect.either(
					storeInputMaterialFx({
						ownerItemId: owner.id,
						lineId: "line:workshop:material",
						inputIndex: 0,
						sourceItemId: movable.id,
						sourceItemRevision: movable.revision,
						quantity: 1,
					}),
				);
				const after = yield* readRuntimeFx();

				return {
					after,
					before,
					inventorySwapped,
					merged,
					moved,
					stored,
					swapped,
				};
			}).pipe(useTestGame),
		);

		expect(Either.isLeft(result.moved)).toBe(true);
		if (Either.isLeft(result.moved)) {
			expect(result.moved.left).toMatchObject({
				_tag: "CrossSpaceBoardOperationError",
			});
		}
		expect(Either.isLeft(result.swapped)).toBe(true);
		if (Either.isLeft(result.swapped)) {
			expect(result.swapped.left).toMatchObject({
				_tag: "CrossSpaceBoardOperationError",
			});
		}
		expect(Either.isLeft(result.inventorySwapped)).toBe(true);
		if (Either.isLeft(result.inventorySwapped)) {
			expect(result.inventorySwapped.left).toMatchObject({
				_tag: "CrossSpaceBoardOperationError",
			});
		}
		expect(Either.isLeft(result.merged)).toBe(true);
		if (Either.isLeft(result.merged)) {
			expect(result.merged.left).toMatchObject({
				_tag: "CrossSpaceBoardOperationError",
			});
		}
		expect(Either.isLeft(result.stored)).toBe(true);
		if (Either.isLeft(result.stored)) {
			expect(result.stored.left).toMatchObject({
				_tag: "CrossSpaceBoardOperationError",
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("uses inventory as the only bridge and targets the current space", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const item = yield* spawnItemFx({
					id: "runtime:traveller",
					itemId: "log",
					location: boardLocation(0, 0),
					quantity: 1,
				});
				const stored = yield* moveItemFx({
					itemId: item.id,
					revision: item.revision,
					location: inventoryLocation(0),
				});
				const early = yield* Effect.either(
					moveItemFx({
						itemId: item.id,
						revision: stored.item.revision,
						location: boardLocation(1, 0),
					}),
				);
				yield* setCurrentSpaceFx({
					space: 1,
				});
				const placed = yield* moveItemFx({
					itemId: item.id,
					revision: stored.item.revision,
					location: boardLocation(1, 0),
				});
				return {
					early,
					placed,
				};
			}).pipe(useTestGame),
		);

		expect(Either.isLeft(result.early)).toBe(true);
		if (Either.isLeft(result.early)) {
			expect(result.early.left).toMatchObject({
				_tag: "CrossSpaceBoardOperationError",
			});
		}
		expect(result.placed.item.location).toEqual(boardLocation(1, 0));
	});
});
