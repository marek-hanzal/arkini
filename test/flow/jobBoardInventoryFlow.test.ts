import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { startLineFx } from "~/v1/job/write/startLineFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { removeItemFx } from "~/v1/runtime/write/removeItemFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { TickFx } from "~/v1/tick/context/TickFx";
import { runTickRuntimeFx } from "~/v1/tick/fx/runTickRuntimeFx";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";

const props = {
	ownerItemId: "runtime:forge",
	lineId: "line:forge:run",
};

const createFlowConfig = (inventoryWidth = 2) => {
	const base = createJobTestConfig(2);
	const forge = base.items.forge;
	if (forge.type !== "producer") throw new Error("Expected producer fixture.");
	return GameConfigSchema.parse({
		...base,
		meta: {
			...base.meta,
			inventory: {
				width: inventoryWidth,
				height: 1,
			},
		},
		items: {
			...base.items,
			blocker: {
				...base.items.tool,
				id: "blocker",
				title: "Blocker",
				description: "Occupies board capacity during completion.",
				maxStackSize: 1,
				scope: "board",
			},
			ingot: {
				...base.items.tool,
				id: "ingot",
				title: "Ingot",
				description: "Produced by the forge.",
			},
			forge: {
				...forge,
				lines: forge.lines.map((line) => ({
					...line,
					output: {
						set: [
							{
								roll: [
									{
										type: "guaranteed",
										drop: [
											{
												itemId: "ingot",
												quantity: {
													type: "value",
													value: 1,
												},
												placement: "drop",
												rules: [],
											},
										],
									},
								],
							},
						],
					},
				})),
			},
		},
	});
};

const createPausedFlowConfig = () => {
	const base = createFlowConfig();
	const forge = base.items.forge;
	if (forge.type !== "producer") throw new Error("Expected producer fixture.");
	return GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			permit: {
				...base.items.tool,
				id: "permit",
				title: "Permit",
				description: "Keeps the forge runnable.",
			},
			forge: {
				...forge,
				lines: forge.lines.map((line) => ({
					...line,
					rules: [
						{
							type: "enable",
							when: [
								{
									type: "exists",
									query: {
										scope: "any",
										selector: {
											type: "item",
											itemId: "permit",
										},
									},
								},
							],
						},
					],
				})),
			},
		},
	});
};

const fillFreeBoardFx = Effect.fn("fillFreeBoardFx")(function* () {
	let blockerIndex = 0;
	for (let y = 0; y < 2; y += 1) {
		for (let x = 0; x < 5; x += 1) {
			if (x === 0 && y === 0) continue;
			yield* spawnItemFx({
				id: `runtime:blocker:${blockerIndex}`,
				itemId: "blocker",
				location: {
					scope: "board",
					position: {
						x,
						y,
					},
				},
				quantity: 1,
			});
			blockerIndex += 1;
		}
	}
});

describe("job board and inventory flow", () => {
	it("runs a queued production chain and stacks released resources plus outputs in inventory", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				const first = yield* startLineFx(props);
				const second = yield* startLineFx(props);
				yield* fillFreeBoardFx();

				const tick = yield* TickFx;
				yield* tick.set({
					nowMs: 2_500,
					elapsedMs: 2_500,
				});
				yield* runTickRuntimeFx();
				return {
					first,
					second,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: createFlowConfig(),
				}),
			),
		);

		expect(result.first.type).toBe("started");
		expect(result.second.type).toBe("queued");
		expect(result.runtime.jobs).toEqual([]);
		expect(result.runtime.jobQueue).toEqual([]);
		expect(result.runtime.items.some((item) => item.location.scope === "job")).toBe(false);
		expect(result.runtime.items.some((item) => item.location.scope === "input")).toBe(false);
		expect(result.runtime.items.filter((item) => item.item.id === "water")).toEqual([]);

		const inventoryItems = result.runtime.items.filter(
			(item) => item.location.scope === "inventory",
		);
		expect(inventoryItems).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					item: expect.objectContaining({
						id: "tool",
					}),
					quantity: 2,
				}),
				expect.objectContaining({
					item: expect.objectContaining({
						id: "ingot",
					}),
					quantity: 2,
				}),
			]),
		);
		expect(inventoryItems).toHaveLength(2);
		expect(result.runtime.items.filter((item) => item.item.id === "blocker")).toHaveLength(9);
	});
	it("rolls back the whole long tick when completion cannot place every release and output", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				yield* startLineFx(props);
				yield* startLineFx(props);
				yield* fillFreeBoardFx();
				const before = yield* readRuntimeFx();

				const tick = yield* TickFx;
				yield* tick.set({
					nowMs: 2_500,
					elapsedMs: 2_500,
				});
				const attempt = yield* Effect.either(runTickRuntimeFx());
				return {
					attempt,
					after: yield* readRuntimeFx(),
					before,
				};
			}).pipe(
				useGameFx({
					config: createFlowConfig(1),
				}),
			),
		);

		expect(Either.isLeft(result.attempt)).toBe(true);
		expect(result.after).toEqual(result.before);
		expect(result.after.jobs).toHaveLength(1);
		expect(result.after.jobQueue).toHaveLength(1);
		expect(result.after.items.filter((item) => item.location.scope === "job")).toHaveLength(1);
		expect(result.after.items.filter((item) => item.item.id === "ingot")).toEqual([]);
	});

	it("pauses a queued production flow without consuming elapsed time and resumes the whole chain later", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const permit = yield* spawnItemFx({
					id: "runtime:permit",
					itemId: "permit",
					location: {
						scope: "board",
						position: {
							x: 4,
							y: 1,
						},
					},
					quantity: 1,
				});
				yield* prepareJobLineFx();
				yield* startLineFx(props);
				yield* startLineFx(props);

				const tick = yield* TickFx;
				yield* tick.set({
					nowMs: 400,
					elapsedMs: 400,
				});
				yield* runTickRuntimeFx();
				const beforePause = yield* readRuntimeFx();

				yield* removeItemFx({
					itemId: permit.id,
					revision: permit.revision,
				});
				yield* tick.set({
					nowMs: 5_400,
					elapsedMs: 5_000,
				});
				yield* runTickRuntimeFx();
				const paused = yield* readRuntimeFx();

				yield* spawnItemFx({
					id: "runtime:permit:return",
					itemId: "permit",
					location: {
						scope: "board",
						position: {
							x: 4,
							y: 1,
						},
					},
					quantity: 1,
				});
				yield* tick.set({
					nowMs: 7_000,
					elapsedMs: 1_600,
				});
				yield* runTickRuntimeFx();
				return {
					beforePause,
					paused,
					completed: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: createPausedFlowConfig(),
				}),
			),
		);

		expect(result.beforePause.jobs[0]?.remainingMs).toBe(600);
		expect(result.paused.jobs[0]?.remainingMs).toBe(600);
		expect(result.paused.jobQueue).toHaveLength(1);
		expect(result.completed.jobs).toEqual([]);
		expect(result.completed.jobQueue).toEqual([]);
		expect(
			result.completed.items
				.filter((item) => item.item.id === "tool")
				.reduce((quantity, item) => quantity + item.quantity, 0),
		).toBe(2);
		expect(
			result.completed.items
				.filter((item) => item.item.id === "ingot")
				.reduce((quantity, item) => quantity + item.quantity, 0),
		).toBe(2);
	});
});
