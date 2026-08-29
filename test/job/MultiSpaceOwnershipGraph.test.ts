import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { startLineFx } from "~test/job/support/startLineTestFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { moveItemFx } from "~/engine/runtime/write/moveItemFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { GameConfigSchema } from "~/game-config/GameConfigSchema";
import { activateSpaceItemFx } from "~/engine/space/write/activateSpaceItemFx";
import { runTickRuntimeByFx } from "~test/support/tick/runTickRuntimeByFx";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";

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
			portal: {
				...base.items.tool,
				uid: "portal",
				id: "portal",
				title: "Portal",
				description: "Moves the active board to the destination space.",
				type: "space",
				space: 1,
			},
			permit: {
				...base.items.tool,
				uid: "permit",
				id: "permit",
				title: "Permit",
				description: "Dependency left behind in the original space.",
				maxStackSize: 1,
			},
			ingot: {
				...base.items.tool,
				uid: "ingot",
				id: "ingot",
				title: "Ingot",
				description: "Completion output.",
				maxStackSize: 1,
			},
			blocker: {
				...base.items.tool,
				uid: "blocker",
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
													min: 1,
													max: 1,
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
	const portal = yield* spawnItemFx({
		id: "runtime:portal",
		itemId: "portal",
		location: {
			scope: "board",
			space: runtime.currentSpace,
			position: {
				x: 0,
				y: 0,
			},
		},
		quantity: 1,
	});
	yield* activateSpaceItemFx({
		currentSpace: runtime.currentSpace,
		itemId: portal.id,
		location: portal.location,
		revision: portal.revision,
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
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config: createConfig("any"),
				}),
			),
		);

		expect(result.jobs).toEqual([
			expect.objectContaining({
				remainingMs: 600,
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
