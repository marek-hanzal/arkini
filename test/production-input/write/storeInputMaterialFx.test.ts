import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { storeInputMaterialFx } from "~/production-input/write/storeInputMaterialFx";
import { queryFx } from "~/engine/query/fx/queryFx";
import { CommittedTransitionsFx } from "~/engine/runtime/context/CommittedTransitionsFx";
import { getItemFx } from "~/engine/runtime/read/getItemFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { moveItemFx } from "~/engine/runtime/write/moveItemFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/production-input/support/inputRuntimeTestConfig";

const spawnOwnerFx = () => {
	return spawnItemFx({
		id: "runtime:workshop",
		itemId: "workshop",
		location: workshopLocation,
		quantity: 1,
	});
};

const spawnSourceFx = ({
	id = "runtime:water",
	itemId = "water",
	quantity,
	x = 1,
}: {
	id?: string;
	itemId?: "stone" | "water";
	quantity: number;
	x?: number;
}) => {
	return spawnItemFx({
		id,
		itemId,
		location: sourceLocation(x),
		quantity,
	});
};

const storeFx = ({
	quantity,
	sourceItemId = "runtime:water",
}: {
	quantity: number;
	sourceItemId?: string;
}) => {
	return Effect.gen(function* () {
		const source = yield* getItemFx({
			itemId: sourceItemId,
		});

		return yield* storeInputMaterialFx({
			ownerItemId: "runtime:workshop",
			lineId: "line:workshop:build",
			inputIndex: 0,
			sourceItemId,
			sourceItemRevision: source.revision,
			quantity,
		});
	});
};

const readBufferedInputItemsFx = Effect.fn("readBufferedInputItemsFx")(function* () {
	const runtime = yield* readRuntimeFx();
	return runtime.items.filter(
		(item) =>
			item.location.scope === "input" &&
			item.location.ownerItemId === "runtime:workshop" &&
			item.location.lineId === "line:workshop:build" &&
			item.location.inputIndex === 0,
	);
});

describe("storeInputMaterialFx", () => {
	it("moves a fully accepted stack into the exact input slot", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const transitions = yield* CommittedTransitionsFx;
				yield* spawnOwnerFx();
				yield* spawnSourceFx({
					quantity: 2,
				});

				const stored = yield* storeFx({
					quantity: 2,
				});
				const item = yield* getItemFx({
					itemId: "runtime:water",
				});
				const queried = yield* queryFx({
					origin: workshopLocation,
					query: {
						scope: "any",
						selector: {
							type: "item",
							itemId: "water",
						},
					},
				});

				return {
					events: (yield* transitions.read).events,
					item,
					queried,
					stored,
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(result.stored.sourceBefore).toMatchObject({
			id: "runtime:water",
			location: sourceLocation(1),
			quantity: 2,
		});
		expect(result.stored.ownerItem).toMatchObject({
			id: "runtime:workshop",
			location: workshopLocation,
		});
		expect(result.stored.sourceItem).toBeUndefined();
		expect(result.stored.storedItem.id).toBe("runtime:water");
		expect(result.events).toEqual([
			{
				type: GameEventEnumSchema.enum.ItemInputStored,
				sourceItemId: "runtime:water",
				canonicalItemId: "water",
				previousSourceLocation: sourceLocation(1),
				previousQuantity: 2,
				storedQuantity: 2,
				resultingQuantity: 0,
				ownerItemId: "runtime:workshop",
				lineId: "line:workshop:build",
				inputIndex: 0,
			},
		]);
		expect(result.item.location).toEqual({
			scope: "input",
			ownerItemId: "runtime:workshop",
			lineId: "line:workshop:build",
			inputIndex: 0,
		});
		expect(result.queried).toEqual([]);
	});

	it("keeps generic grid movement from bypassing the input command boundary", () => {
		const moved = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnSourceFx({
					quantity: 2,
				});
				yield* storeFx({
					quantity: 2,
				});

				const item = yield* getItemFx({
					itemId: "runtime:water",
				});

				return yield* Effect.result(
					moveItemFx({
						itemId: "runtime:water",
						location: sourceLocation(2),
						revision: item.revision,
					}),
				);
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(Result.isFailure(moved)).toBe(true);
		if (Result.isFailure(moved)) {
			expect(moved.failure).toMatchObject({
				_tag: "ItemNotOnGridError",
				itemId: "runtime:water",
			});
		}
	});

	it("splits a partially accepted stack without changing the source location", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnSourceFx({
					quantity: 5,
				});

				const stored = yield* storeFx({
					quantity: 2,
				});
				const source = yield* getItemFx({
					itemId: "runtime:water",
				});
				const buffered = yield* readBufferedInputItemsFx();

				return {
					buffered,
					source,
					stored,
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(result.stored.sourceBefore).toMatchObject({
			id: "runtime:water",
			location: sourceLocation(1),
			quantity: 5,
		});
		expect(result.source).toMatchObject({
			id: "runtime:water",
			location: sourceLocation(1),
			quantity: 3,
		});
		expect(result.stored.sourceItem).toEqual(result.source);
		expect(result.stored.storedItem.id).not.toBe("runtime:water");
		expect(result.buffered).toEqual([
			result.stored.storedItem,
		]);
	});

	it("accepts only remaining slot capacity across multiple deliveries", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnSourceFx({
					quantity: 4,
				});
				yield* spawnSourceFx({
					id: "runtime:water:second",
					quantity: 3,
					x: 2,
				});
				yield* storeFx({
					quantity: 4,
				});
				const second = yield* storeFx({
					quantity: 3,
					sourceItemId: "runtime:water:second",
				});
				const buffered = yield* readBufferedInputItemsFx();

				return {
					buffered,
					second,
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(result.second.storedItem.quantity).toBe(1);
		expect(result.second.sourceItem?.quantity).toBe(2);
		expect(result.buffered.reduce((quantity, item) => quantity + item.quantity, 0)).toBe(5);
	});

	it("rejects unavailable material without partially changing runtime", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnSourceFx({
					id: "runtime:stone",
					itemId: "stone",
					quantity: 2,
				});
				const stored = yield* Effect.result(
					storeFx({
						quantity: 2,
						sourceItemId: "runtime:stone",
					}),
				);
				const runtime = yield* readRuntimeFx();

				return {
					runtime,
					stored,
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(Result.isFailure(result.stored)).toBe(true);
		if (Result.isFailure(result.stored)) {
			expect(result.stored.failure).toMatchObject({
				_tag: "InputMaterialUnavailableError",
				sourceItemId: "runtime:stone",
			});
		}
		expect(result.runtime.items).toHaveLength(2);
		expect(result.runtime.items[1]).toMatchObject({
			id: "runtime:stone",
			location: sourceLocation(1),
			quantity: 2,
		});
	});

	it("serializes concurrent deliveries from the same source stack", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				const source = yield* spawnSourceFx({
					quantity: 2,
				});
				const attempts = yield* Effect.all(
					[
						Effect.result(
							storeInputMaterialFx({
								ownerItemId: "runtime:workshop",
								lineId: "line:workshop:build",
								inputIndex: 0,
								sourceItemId: source.id,
								sourceItemRevision: source.revision,
								quantity: 1,
							}),
						),
						Effect.result(
							storeInputMaterialFx({
								ownerItemId: "runtime:workshop",
								lineId: "line:workshop:build",
								inputIndex: 0,
								sourceItemId: source.id,
								sourceItemRevision: source.revision,
								quantity: 1,
							}),
						),
					],
					{
						concurrency: "unbounded",
					},
				);
				const buffered = yield* readBufferedInputItemsFx();
				const runtime = yield* readRuntimeFx();

				return {
					attempts,
					buffered,
					runtime,
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(result.attempts.filter(Result.isSuccess)).toHaveLength(1);
		expect(result.attempts.filter(Result.isFailure)).toHaveLength(1);
		expect(result.buffered.reduce((total, item) => total + item.quantity, 0)).toBe(1);
		expect(
			result.runtime.items.some((item) => {
				return (
					item.id === "runtime:water" &&
					item.location.scope !== "input" &&
					item.quantity === 1
				);
			}),
		).toBe(true);
		const conflict = result.attempts.find(Result.isFailure);
		if (conflict === undefined || Result.isSuccess(conflict)) {
			throw new Error("Expected one stale input delivery conflict.");
		}
		expect(conflict.failure).toMatchObject({
			_tag: "RevisionConflictError",
			entityId: "runtime:water",
		});
	});
});
