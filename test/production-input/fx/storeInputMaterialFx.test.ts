import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { queryFx } from "~/item-query/fx/queryFx";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { getItemFx } from "~test/support/getItemFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { DropItemRejectedReason, DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import { dropItemFx } from "~/item-interaction/fx/dropItemFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
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
	});
};

const spawnSourceFx = ({
	id = "runtime:water",
	itemId = "water",
	x = 1,
}: {
	id?: string;
	itemId?: "stone" | "water";
	x?: number;
}) => {
	return spawnItemFx({
		id,
		itemId,
		location: sourceLocation(x),
	});
};

const storeFx = ({ sourceItemId = "runtime:water" }: { sourceItemId?: string }) => {
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
	it("moves one identity into the exact input slot", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const transitions = yield* CommittedTransitionsFx;
				yield* spawnOwnerFx();
				yield* spawnSourceFx({});

				const stored = yield* storeFx({});
				const item = yield* getItemFx({
					itemId: "runtime:water",
				});
				const queried = yield* queryFx({
					origin: workshopLocation,
					query: {
						distance: "far" as const,
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
		});
		expect(result.stored.ownerItem).toMatchObject({
			id: "runtime:workshop",
			location: workshopLocation,
		});
		expect(result.stored.storedItem.id).toBe("runtime:water");
		expect(result.events).toEqual([
			{
				type: GameEventEnumSchema.enum.ItemInputStored,
				sourceItemId: "runtime:water",
				canonicalItemId: "water",
				previousSourceLocation: sourceLocation(1),
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

	it("keeps item drops from bypassing the input command boundary", () => {
		const moved = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnSourceFx({});
				yield* storeFx({});

				const item = yield* getItemFx({
					itemId: "runtime:water",
				});

				return yield* dropItemFx({
					sourceItemId: "runtime:water",
					sourceLocation: sourceLocation(1),
					sourceRevision: item.revision,
					target: {
						kind: "slot",
						location: sourceLocation(2),
						occupant: null,
					},
				});
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(moved).toEqual({
			kind: DropItemResultKind.Reject,
			reason: DropItemRejectedReason.InvalidSource,
			itemId: "runtime:water",
		});
	});

	it("rejects a fourth identity atomically after three deliveries fill the slot", () => {
		Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				for (let index = 0; index < 3; index++) {
					const id = `runtime:water:${index}`;
					yield* spawnSourceFx({
						id,
					});
					yield* storeFx({
						sourceItemId: id,
					});
				}
				yield* spawnSourceFx({
					id: "runtime:overflow",
				});
				const before = yield* readRuntimeFx();
				expect(
					yield* Effect.flip(
						storeFx({
							sourceItemId: "runtime:overflow",
						}),
					),
				).toMatchObject({
					_tag: "InputMaterialUnavailableError",
				});
				expect(yield* readRuntimeFx()).toEqual(before);
				expect(yield* readBufferedInputItemsFx()).toHaveLength(3);
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);
	});

	it("rejects unavailable material without partially changing runtime", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnSourceFx({
					id: "runtime:stone",
					itemId: "stone",
				});
				const stored = yield* Effect.result(
					storeFx({
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
		});
	});

	it("serializes concurrent deliveries from the same source identity", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				const source = yield* spawnSourceFx({});
				const attempts = yield* Effect.all(
					[
						Effect.result(
							storeInputMaterialFx({
								ownerItemId: "runtime:workshop",
								lineId: "line:workshop:build",
								inputIndex: 0,
								sourceItemId: source.id,
								sourceItemRevision: source.revision,
							}),
						),
						Effect.result(
							storeInputMaterialFx({
								ownerItemId: "runtime:workshop",
								lineId: "line:workshop:build",
								inputIndex: 0,
								sourceItemId: source.id,
								sourceItemRevision: source.revision,
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
		expect(result.buffered).toHaveLength(1);
		expect(
			result.runtime.items.find((item) => item.id === "runtime:water")?.location.scope,
		).toBe("input");
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
