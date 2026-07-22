import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { readOwnerJobQueueFx } from "~/engine/job/read/readOwnerJobQueueFx";
import { startLineFx } from "~/engine/job/write/startLineFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { moveItemFx } from "~/engine/runtime/write/moveItemFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { setCurrentSpaceFx } from "~/engine/space/write/setCurrentSpaceFx";
import { runTickRuntimeByFx } from "~/engine/tick/fx/runTickRuntimeByFx";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";
import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";

const ownerItemId = "runtime:forge";
const lineId = "line:forge:run";

const createConfig = (scope: "any" | "universe") => {
	const base = createJobTestConfig(2, "any");
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
				description: "Dependency left behind in the original space.",
				maxStackSize: 1,
			},
			ingot: {
				...base.items.tool,
				id: "ingot",
				title: "Ingot",
				description: "Completion output.",
				maxStackSize: 1,
			},
			blocker: {
				...base.items.tool,
				id: "blocker",
				title: "Blocker",
				description: "Fills destination capacity.",
				maxStackSize: 1,
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
										scope,
										selector: {
											type: "item",
											itemId: "permit",
										},
									},
								},
							],
						},
					],
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

const moveOwnerToSpaceFx = Effect.fn("moveOwnerToSpaceFx")(function* (space: number) {
	let runtime = yield* readRuntimeFx();
	let owner = runtime.items.find((item) => item.id === ownerItemId);
	if (owner === undefined) throw new Error("Expected owner.");
	yield* moveItemFx({
		itemId: owner.id,
		revision: owner.revision,
		location: {
			scope: "inventory",
			position: {
				x: 0,
				y: 0,
			},
		},
	});
	yield* setCurrentSpaceFx({
		space,
	});
	runtime = yield* readRuntimeFx();
	owner = runtime.items.find((item) => item.id === ownerItemId);
	if (owner === undefined) throw new Error("Expected owner in inventory.");
	yield* moveItemFx({
		itemId: owner.id,
		revision: owner.revision,
		location: {
			scope: "board",
			space,
			position: {
				x: 0,
				y: 0,
			},
		},
	});
});

const prepareTravelFx = Effect.fn("prepareTravelFx")(function* () {
	yield* prepareJobLineFx();
	yield* spawnItemFx({
		id: "runtime:permit",
		itemId: "permit",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 4,
				y: 1,
			},
		},
		quantity: 1,
	});
	yield* startLineFx({
		ownerItemId,
		lineId,
	});
	yield* runTickRuntimeByFx({
		elapsedMs: 400,
	});
	yield* moveOwnerToSpaceFx(1);
});

const fillDestinationFx = Effect.fn("fillDestinationFx")(function* () {
	let index = 0;
	for (let y = 0; y < 2; y += 1) {
		for (let x = 0; x < 5; x += 1) {
			if (x === 0 && y === 0) continue;
			yield* spawnItemFx({
				id: `runtime:blocker:board:${index}`,
				itemId: "blocker",
				location: {
					scope: "board",
					space: 1,
					position: {
						x,
						y,
					},
				},
				quantity: 1,
			});
			index += 1;
		}
	}
	for (let x = 0; x < 3; x += 1) {
		yield* spawnItemFx({
			id: `runtime:blocker:inventory:${x}`,
			itemId: "blocker",
			location: {
				scope: "inventory",
				position: {
					x,
					y: 0,
				},
			},
			quantity: 1,
		});
	}
});

describe("multi-space owner ownership graph", () => {
	it("pauses after travel when a local any dependency remains in the original space", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareTravelFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 600,
				});
				return yield* readOwnerJobQueueFx({
					ownerItemId,
				});
			}).pipe(
				useGameFx({
					config: createConfig("any"),
				}),
			),
		);

		expect(result).toEqual([
			expect.objectContaining({
				status: JobStatusEnumSchema.enum.Paused,
				job: expect.objectContaining({
					remainingMs: 600,
				}),
			}),
		]);
	});

	it("keeps universe dependencies and materializes output plus reservations in the destination space", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareTravelFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 600,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config: createConfig("universe"),
				}),
			),
		);

		expect(runtime.jobs).toEqual([]);
		expect(
			runtime.items.some(
				(item) =>
					item.item.id === "ingot" &&
					item.location.scope === "board" &&
					item.location.space === 1,
			),
		).toBe(true);
		expect(
			runtime.items.some(
				(item) =>
					item.item.id === "tool" &&
					item.location.scope === "board" &&
					item.location.space === 1,
			),
		).toBe(true);
		expect(
			runtime.items.some(
				(item) =>
					item.item.id === "ingot" &&
					item.location.scope === "board" &&
					item.location.space === 0,
			),
		).toBe(false);
	});

	it("blocks completion when neither destination space nor inventory can accept survivors", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareTravelFx();
				yield* fillDestinationFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 600,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config: createConfig("universe"),
				}),
			),
		);

		expect(runtime.jobs).toEqual([
			expect.objectContaining({
				remainingMs: 0,
			}),
		]);
		expect(runtime.items.some((item) => item.item.id === "ingot")).toBe(false);
		expect(runtime.items.some((item) => item.location.scope === "reserved")).toBe(true);
	});
});
