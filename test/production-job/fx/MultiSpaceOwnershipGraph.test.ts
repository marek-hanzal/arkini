import { dropItemFx } from "~/item-interaction/fx/dropItemFx";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { createItemBase } from "~test/game-config-validation/support/gameValidationTestSource";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { activateItemActionFx } from "~/item-action/fx/activateItemActionFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { createJobTestConfig, prepareJobLineFx } from "~test/production-job/support/jobTestConfig";

const ownerItemId = "runtime:forge";
const lineId = "line:forge:run";

const createConfig = (distance: "far" | "universe") => {
	const base = createJobTestConfig(2);
	const forge = base.items.forge;

	return GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			portal: {
				...createItemBase("portal"),
				uid: "portal",
				id: "portal",
				title: "Portal",
				description: "Moves the active board to the destination space.",

				action: {
					type: "space" as const,
					space: 1,
				},
			},
			permit: {
				...base.items.tool,
				uid: "permit",
				id: "permit",
				title: "Permit",
				description: "Dependency left behind in the original space.",
			},
			ingot: {
				...base.items.tool,
				uid: "ingot",
				id: "ingot",
				title: "Ingot",
				description: "Completion output.",
			},
			blocker: {
				...base.items.tool,
				uid: "blocker",
				id: "blocker",
				title: "Blocker",
				description: "Fills destination capacity.",
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
										distance,
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
								rules: [],
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
	const runtime = yield* readRuntimeFx();
	const owner = runtime.items.find((item) => item.id === ownerItemId)!;
	const portal = yield* spawnItemFx({
		id: "runtime:portal",
		itemId: "portal",
		location: {
			scope: "board",
			space: runtime.currentSpace,
			position: {
				x: 4,
				y: 0,
			},
		},
	});
	const result = yield* dropItemFx({
		sourceItemId: owner.id,
		sourceRevision: owner.revision,
		sourceLocation: owner.location as BoardLocationSchema.Type,
		target: {
			kind: "slot",
			location: portal.location as BoardLocationSchema.Type,
			occupant: {
				itemId: portal.id,
				revision: portal.revision,
			},
		},
	});
	if (result.kind !== "move") throw new Error("Expected portal transfer.");
	yield* activateItemActionFx({
		currentSpace: runtime.currentSpace,
		itemId: portal.id,
		location: portal.location,
		revision: portal.revision,
	});
	if (space !== 1) throw new Error("Expected destination space.");
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

describe("multi-space owner ownership graph", () => {
	it("pauses after travel when a local dependency remains in the original space", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareTravelFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 600,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config: createConfig("far"),
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
});
