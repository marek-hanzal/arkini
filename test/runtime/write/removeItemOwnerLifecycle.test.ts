import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { storeInputMaterialFx } from "~/v1/input/write/storeInputMaterialFx";
import { startLineFx } from "~/v1/job/write/startLineFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { moveItemFx } from "~/v1/runtime/write/moveItemFx";
import { removeItemFx } from "~/v1/runtime/write/removeItemFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { createJobTestConfig, prepareJobLineFx } from "../../job/support/jobTestConfig";

const startProps = {
	ownerItemId: "runtime:forge",
	lineId: "line:forge:run",
} as const;

const prepareIdleOwnerInputsFx = Effect.fn("prepareIdleOwnerInputsFx")(function* () {
	const owner = yield* spawnItemFx({
		id: "runtime:forge",
		itemId: "forge",
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
	const water = yield* spawnItemFx({
		id: "runtime:water",
		itemId: "water",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 1,
				y: 0,
			},
		},
		quantity: 3,
	});
	const tool = yield* spawnItemFx({
		id: "runtime:tool",
		itemId: "tool",
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
	yield* storeInputMaterialFx({
		ownerItemId: owner.id,
		lineId: startProps.lineId,
		inputIndex: 0,
		sourceItemId: water.id,
		sourceItemRevision: water.revision,
		quantity: 3,
	});
	yield* storeInputMaterialFx({
		ownerItemId: owner.id,
		lineId: startProps.lineId,
		inputIndex: 1,
		sourceItemId: tool.id,
		sourceItemRevision: tool.revision,
		quantity: 1,
	});
	return owner;
});

describe("removeItemFx owner lifecycle", () => {
	it("rejects removing an owner with active and queued work", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* prepareJobLineFx();
				const started = yield* startLineFx(startProps);
				const water = yield* spawnItemFx({
					id: "runtime:water:queued",
					itemId: "water",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 3,
							y: 0,
						},
					},
					quantity: 3,
				});
				const tool = yield* spawnItemFx({
					id: "runtime:tool:queued",
					itemId: "tool",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 4,
							y: 0,
						},
					},
					quantity: 1,
				});
				yield* storeInputMaterialFx({
					ownerItemId: owner.id,
					lineId: startProps.lineId,
					inputIndex: 0,
					sourceItemId: water.id,
					sourceItemRevision: water.revision,
					quantity: 3,
				});
				yield* storeInputMaterialFx({
					ownerItemId: owner.id,
					lineId: startProps.lineId,
					inputIndex: 1,
					sourceItemId: tool.id,
					sourceItemRevision: tool.revision,
					quantity: 1,
				});
				const queued = yield* startLineFx(startProps);
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.either(
					removeItemFx({
						itemId: owner.id,
						revision: owner.revision,
					}),
				);
				const after = yield* readRuntimeFx();
				return {
					after,
					attempt,
					before,
					queued,
					started,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(),
				}),
			),
		);

		expect(Either.isLeft(result.attempt)).toBe(true);
		if (
			Either.isLeft(result.attempt) &&
			result.started.type === "started" &&
			result.queued.type === "queued"
		) {
			expect(result.attempt.left).toMatchObject({
				_tag: "JobOwnerBusyError",
				ownerItemId: startProps.ownerItemId,
				jobIds: [
					result.started.job.id,
				],
				requestIds: [
					result.queued.request.id,
				],
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("atomically removes one idle owner and releases every buffered input through drop placement", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* prepareIdleOwnerInputsFx();
				const removed = yield* removeItemFx({
					itemId: owner.id,
					revision: owner.revision,
				});
				const runtime = yield* readRuntimeFx();
				return {
					removed,
					runtime,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(),
				}),
			),
		);

		expect(result.removed.id).toBe(startProps.ownerItemId);
		expect(result.runtime.items.some((item) => item.id === startProps.ownerItemId)).toBe(false);
		expect(result.runtime.items.some((item) => item.location.scope === "input")).toBe(false);
		expect(
			result.runtime.items
				.filter((item) => item.item.id === "water")
				.reduce((total, item) => total + item.quantity, 0),
		).toBe(3);
		expect(
			result.runtime.items
				.filter((item) => item.item.id === "tool")
				.reduce((total, item) => total + item.quantity, 0),
		).toBe(1);
		expect(result.runtime.items.every((item) => item.location.scope !== "input")).toBe(true);
		expect(
			result.runtime.items
				.filter((item) => item.item.id === "water" || item.item.id === "tool")
				.every((item) => item.location.scope === "board"),
		).toBe(true);
	});

	it("rejects releasing buffered inputs from a passive inventory owner", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* prepareIdleOwnerInputsFx();
				const moved = yield* moveItemFx({
					itemId: owner.id,
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					revision: owner.revision,
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.either(
					removeItemFx({
						itemId: owner.id,
						revision: moved.item.revision,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(2, "any"),
				}),
			),
		);

		expect(Either.isLeft(result.attempt)).toBe(true);
		if (Either.isLeft(result.attempt)) {
			expect(result.attempt.left).toMatchObject({
				_tag: "ItemNotOnBoardError",
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("keeps the owner and every buffered input when one released item cannot be placed", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* prepareIdleOwnerInputsFx();
				for (const [index, position] of [
					{
						x: 1,
						y: 0,
					},
					{
						x: 2,
						y: 0,
					},
					{
						x: 3,
						y: 0,
					},
					{
						x: 4,
						y: 0,
					},
					{
						x: 0,
						y: 1,
					},
					{
						x: 1,
						y: 1,
					},
					{
						x: 2,
						y: 1,
					},
					{
						x: 3,
						y: 1,
					},
					{
						x: 4,
						y: 1,
					},
				].entries()) {
					yield* spawnItemFx({
						id: `runtime:board-fill:${index}`,
						itemId: "water",
						location: {
							scope: "board",
							space: 0,
							position,
						},
						quantity: 10,
					});
				}
				for (let x = 0; x < 3; x += 1) {
					yield* spawnItemFx({
						id: `runtime:inventory-fill:${x}`,
						itemId: "water",
						location: {
							scope: "inventory",
							position: {
								x,
								y: 0,
							},
						},
						quantity: 10,
					});
				}
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.either(
					removeItemFx({
						itemId: owner.id,
						revision: owner.revision,
					}),
				);
				const after = yield* readRuntimeFx();
				return {
					after,
					attempt,
					before,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(),
				}),
			),
		);

		expect(Either.isLeft(result.attempt)).toBe(true);
		if (Either.isLeft(result.attempt)) {
			expect(result.attempt.left).toMatchObject({
				_tag: "PlacementUnavailableError",
			});
		}
		expect(result.after).toEqual(result.before);
	});
});
