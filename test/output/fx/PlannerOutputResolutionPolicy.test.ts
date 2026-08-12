import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import { makePlannerGamePolicyLayerFx } from "~/engine/game/layer/PlannerGamePolicyLayerFx";
import { resolveOutputFx } from "~/engine/output/fx/resolveOutputFx";
import { OutputSchema } from "~/engine/output/schema/OutputSchema";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

const runtime = {
	cheats: {
		enabled: false,
		everEnabled: false,
		instantGameplay: false,
	},
	currentSpace: 0,
	items: [],
	jobQueue: [],
	jobs: [],
} satisfies RuntimeSchema.Type;

const source = {
	lineId: "line:test",
	ownerItemId: "producer:test",
	type: "line",
} as const;

const origin = {
	position: {
		x: 0,
		y: 0,
	},
	scope: "board",
	space: 0,
} as const;

const output = OutputSchema.parse({
	set: [
		{
			roll: [
				{
					drop: [
						{
							itemId: "item:decoy",
							quantity: {
								max: 2,
								min: 1,
							},
							rules: [],
						},
					],
					type: "guaranteed",
				},
			],
			weight: 1,
		},
		{
			roll: [
				{
					drop: [
						{
							itemId: "item:base",
							quantity: {
								max: 1,
								min: 1,
							},
							rules: [],
						},
					],
					type: "guaranteed",
				},
				{
					chance: 0.5,
					drop: [
						{
							itemId: "item:bonus",
							quantity: {
								max: 1,
								min: 1,
							},
							rules: [],
						},
					],
					type: "chance",
				},
				{
					drop: [
						{
							drop: [
								{
									itemId: "item:weighted-decoy",
									quantity: {
										max: 1,
										min: 1,
									},
									rules: [],
								},
							],
							weight: 1,
						},
						{
							drop: [
								{
									itemId: "item:target",
									quantity: {
										max: 4,
										min: 2,
									},
									rules: [],
								},
								{
									itemId: "item:companion",
									quantity: {
										max: 2,
										min: 1,
									},
									rules: [],
								},
							],
							weight: 1,
						},
					],
					quantity: {
						max: 3,
						min: 2,
					},
					type: "weight",
				},
			],
			weight: 3,
		},
	],
});

const aggregate = (
	drop: ReadonlyArray<{
		readonly itemId: string;
		readonly quantity: number;
	}>,
) =>
	drop.reduce<Record<string, number>>((quantities, candidate) => {
		quantities[candidate.itemId] = (quantities[candidate.itemId] ?? 0) + candidate.quantity;
		return quantities;
	}, {});

const resolve = ({
	ambientSeed,
	witness,
}: {
	readonly ambientSeed: string;
	readonly witness?: {
		readonly candidateIndex?: number;
		readonly dropIndex: number;
		readonly itemId: string;
		readonly rollIndex: number;
		readonly setIndex: number;
	};
}) =>
	Effect.runPromise(
		resolveOutputFx({
			origin,
			output,
			source,
		}).pipe(
			Effect.provide(
				makePlannerGamePolicyLayerFx(
					witness === undefined
						? undefined
						: {
								source,
								witness,
							},
				),
			),
			Effect.provideService(RuntimeFx, {
				read: Effect.succeed(runtime),
			}),
			Random.withSeed(ambientSeed),
		),
	);

describe("Planner output resolution policy", () => {
	it("pins the baseline branch independently of ambient randomness", async () => {
		const results = await Promise.all(
			Array.from(
				{
					length: 16,
				},
				(_, index) =>
					resolve({
						ambientSeed: `ambient:${index}`,
					}),
			),
		);

		expect(
			results.every((result) => JSON.stringify(result) === JSON.stringify(results[0])),
		).toBe(true);
	});

	it("realizes one correlated integer witness for a weighted stochastic route", async () => {
		const results = await Promise.all(
			Array.from(
				{
					length: 16,
				},
				(_, index) =>
					resolve({
						ambientSeed: `ambient:${index}`,
						witness: {
							candidateIndex: 1,
							dropIndex: 0,
							itemId: "item:target",
							rollIndex: 2,
							setIndex: 1,
						},
					}),
			),
		);

		for (const result of results)
			expect(aggregate(result.drop)).toEqual({
				"item:base": 1,
				"item:companion": 6,
				"item:target": 12,
			});
	});
});
