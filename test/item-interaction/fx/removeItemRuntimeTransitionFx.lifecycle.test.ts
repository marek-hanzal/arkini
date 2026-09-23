import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { removeCheatItemFx } from "~/game-cheat/fx/removeCheatItemFx";
import { setCheatEnabledFx } from "~/game-cheat/fx/setCheatEnabledFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { useGameFx } from "~test/support/useGameFx";
import { bufferInputMaterialForTestFx } from "~test/support/bufferInputMaterialForTestFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { createJobTestConfig, prepareJobLineFx } from "~test/production-job/support/jobTestConfig";

const startProps = {
	ownerItemId: "runtime:forge",
	lineId: "line:forge:run",
} as const;

const prepareIdleOwnerInputsFx = Effect.fn("prepareIdleOwnerInputsFx")(function* () {
	const owner = yield* spawnItemFx({
		id: "runtime:forge",
		itemUid: "forge",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		},
	});
	for (let index = 0; index < 3; index++) {
		const water = yield* spawnItemFx({
			id: `runtime:water:${index}`,
			itemUid: "water",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 1,
					y: 0,
				},
			},
		});
		yield* bufferInputMaterialForTestFx({
			ownerItemId: owner.id,
			lineId: startProps.lineId,
			inputIndex: 0,
			sourceItemId: water.id,
			sourceItemRevision: water.revision,
		});
	}

	const tool = yield* spawnItemFx({
		id: "runtime:tool",
		itemUid: "tool",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 2,
				y: 0,
			},
		},
	});
	yield* bufferInputMaterialForTestFx({
		ownerItemId: owner.id,
		lineId: startProps.lineId,
		inputIndex: 1,
		sourceItemId: tool.id,
		sourceItemRevision: tool.revision,
	});
	return owner;
});

describe("removeItemRuntimeTransitionFx owner lifecycle", () => {
	it("rejects removing an owner with active and queued work", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* prepareJobLineFx();
				const started = yield* startLineFx(startProps);
				const queued = yield* enqueueLineFx(startProps);
				yield* setCheatEnabledFx({
					enabled: true,
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(
					removeCheatItemFx({
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

		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isFailure(result.attempt) && result.started.type === "started") {
			expect(result.attempt.failure).toMatchObject({
				_tag: "JobOwnerBusyError",
				ownerItemId: startProps.ownerItemId,
				jobIds: [
					result.started.job.id,
				],
				requestIds: [
					result.queued.id,
				],
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("atomically removes one idle owner and releases every buffered input through drop placement", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* prepareIdleOwnerInputsFx();
				yield* setCheatEnabledFx({
					enabled: true,
				});
				const removed = yield* removeCheatItemFx({
					itemId: owner.id,
					revision: owner.revision,
				});
				const transition = yield* (yield* CommittedTransitionsFx).read;
				const runtime = yield* readRuntimeFx();
				return {
					removed,
					runtime,
					transition,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(),
				}),
			),
		);

		expect(result.removed.id).toBe(startProps.ownerItemId);
		expect(result.transition.events[0]).toEqual({
			type: GameEventEnumSchema.enum.ItemDisappeared,
			itemId: startProps.ownerItemId,
			itemUid: "forge",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 0,
					y: 0,
				},
			},
		});
		expect(result.transition.events.slice(1)).not.toHaveLength(0);
		expect(
			result.transition.events
				.slice(1)
				.some((event) => event.type === GameEventEnumSchema.enum.ItemDisappeared),
		).toBe(false);
		expect(result.runtime.items.some((item) => item.id === startProps.ownerItemId)).toBe(false);
		expect(result.runtime.items.some((item) => item.location.scope === "input")).toBe(false);
		expect(result.runtime.items.filter((item) => item.item.uid === "water").length).toBe(3);
		expect(result.runtime.items.filter((item) => item.item.uid === "tool").length).toBe(1);
		expect(result.runtime.items.every((item) => item.location.scope !== "input")).toBe(true);
		expect(
			result.runtime.items
				.filter((item) => item.item.uid === "water" || item.item.uid === "tool")
				.every((item) => item.location.scope === "board"),
		).toBe(true);
	});

	it("serializes concurrent public cheat removals of one identity", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const item = yield* spawnItemFx({
					id: "runtime:water",
					itemUid: "water",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				yield* setCheatEnabledFx({
					enabled: true,
				});
				const attempts = yield* Effect.all(
					[
						Effect.result(
							removeCheatItemFx({
								itemId: item.id,
								revision: item.revision,
							}),
						),
						Effect.result(
							removeCheatItemFx({
								itemId: item.id,
								revision: item.revision,
							}),
						),
					],
					{
						concurrency: "unbounded",
					},
				);
				return {
					attempts,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(),
				}),
			),
		);

		expect(result.attempts.filter(Result.isSuccess)).toHaveLength(1);
		expect(result.attempts.filter(Result.isFailure)).toHaveLength(1);
		expect(result.runtime.items.some((item) => item.id === "runtime:water")).toBe(false);
	});
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
					itemUid: "water",
					location: {
						scope: "board",
						space: 0,
						position,
					},
				});
			}
			yield* setCheatEnabledFx({
				enabled: true,
			});
			const before = yield* readRuntimeFx();
			const attempt = yield* Effect.result(
				removeCheatItemFx({
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

	expect(Result.isFailure(result.attempt)).toBe(true);
	if (Result.isFailure(result.attempt)) {
		expect(result.attempt.failure).toMatchObject({
			_tag: "PlacementUnavailableError",
		});
	}
	expect(result.after).toEqual(result.before);
});
