import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
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
				description: "Completion outcome.",
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
					outcome: {
						set: [
							{
								rules: [],
								roll: [
									{
										type: "guaranteed",
										outcome: [
											{
												type: "item" as const,
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

// Hydrated ownership can live on any Board; relocation is fixture setup, not a portal behavior.
const moveOwnerToSpaceFx = Effect.fn("moveOwnerToSpaceFx")(function* (space: number) {
	yield* modifyRuntimeFx((runtime) =>
		Effect.succeed([
			undefined,
			{
				...runtime,
				currentSpace: space,
				items: runtime.items.map((item) =>
					item.id === ownerItemId
						? {
								...item,
								location: {
									scope: "board" as const,
									space,
									position: {
										x: 0,
										y: 0,
									},
								},
							}
						: item,
				),
			},
		] as const),
	);
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

	it("keeps universe dependencies and materializes outcome plus reservations in the destination space", () => {
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
