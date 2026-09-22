import { Effect } from "effect";
import { expect, it } from "vitest";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/production-input/support/inputRuntimeTestConfig";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import type { QuerySchema } from "~/item-query/schema/QuerySchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { planLineInputAutofillFx } from "~/production-input/fx/planLineInputAutofillFx";
import { autofillLineInputFx } from "~/production-input/fx/autofillLineInputFx";
import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { readItemLineInputsFx } from "~/item-detail-read/fx/readItemLineInputsFx";
import { readItemDetailMaterialAutofillAvailabilityFx } from "~/item-line-detail/fx/readItemDetailMaterialAutofillAvailabilityFx";

const target = {
	ownerItemId: "owner",
	lineId: "build",
};
const selector = {
	type: "item",
	itemId: "water",
} as const;
const configFn = (queries: ReadonlyArray<QuerySchema.Type>) =>
	GameConfigSchema.parse({
		...inputRuntimeTestConfig,
		items: {
			...inputRuntimeTestConfig.items,
			workshop: {
				...inputRuntimeTestConfig.items.workshop,
				lines: [
					{
						...inputRuntimeTestConfig.items.workshop.lines[0],
						id: target.lineId,
						input: queries.map((query) => ({
							type: "materials",
							mode: "consume",
							quantity: {
								min: 1,
								max: 1,
							},
							query,
						})),
					},
				],
			},
		},
	});
const locations: ReadonlyArray<
	readonly [
		string,
		GridLocationSchema.Type,
	]
> = [
	[
		"close",
		sourceLocation(1),
	],
	[
		"near",
		sourceLocation(2),
	],
	[
		"far",
		sourceLocation(3),
	],
	[
		"remote",
		{
			...sourceLocation(1),
			space: 1,
		},
	],
];
const spawnFx = Effect.gen(function* () {
	yield* spawnItemFx({
		id: "owner",
		itemId: "workshop",
		location: workshopLocation,
		quantity: 1,
	});
	for (const [id, location] of locations)
		yield* spawnItemFx({
			id,
			itemId: "water",
			location,
			quantity: 2,
		});
});

it("delivers universe material from another board space through ordinary settlement", () => {
	const config = configFn([
		{
			distance: "universe" as const,
			selector,
		},
	]);
	Effect.runSync(
		Effect.gen(function* () {
			yield* spawnItemFx({
				id: "owner",
				itemId: "workshop",
				location: workshopLocation,
				quantity: 1,
			});
			yield* spawnItemFx({
				id: "remote",
				itemId: "water",
				location: {
					...sourceLocation(1),
					space: 1,
				},
				quantity: 1,
			});
			expect(
				yield* autofillLineInputFx({
					...target,
					inputIndex: 0,
				}),
			).toBe(1);
			yield* runTickRuntimeByFx({
				elapsedMs: 1000,
			});
			const runtime = yield* readRuntimeFx();
			expect(runtime.items.find((item) => item.id === "remote")?.location).toMatchObject({
				scope: "input",
				ownerItemId: "owner",
				inputIndex: 0,
			});
			expect(runtime.jobs).toEqual([]);
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
});

it.each([
	[
		{
			distance: "near-close",
			selector,
		},
		[
			"close",
			"near",
		],
	],
	[
		{
			distance: "far" as const,
			selector,
		},
		[
			"close",
			"near",
			"far",
		],
	],
	[
		{
			distance: "universe" as const,
			selector,
		},
		[
			"close",
			"near",
			"far",
			"remote",
		],
	],
] satisfies Array<
	[
		QuerySchema.Type,
		string[],
	]
>)("uses authored reach %j consistently in planning and availability", (query, expected) => {
	const config = configFn([
		query,
	]);
	// Large capacity exposes every selected source, not just the first match.
	const line = config.items.workshop.lines[0]!;
	const input = line.input[0]!;
	if (input.type !== "materials") throw new Error("Expected material");
	input.quantity = {
		min: 1,
		max: 20,
	};
	Effect.runSync(
		Effect.gen(function* () {
			yield* spawnFx;
			const runtime = yield* readRuntimeFx();
			const plan = yield* planLineInputAutofillFx({
				...target,
				runtime,
			});
			expect(plan.entry.map((entry) => entry.sourceItemId)).toEqual(expected);
			const availability = yield* readItemDetailMaterialAutofillAvailabilityFx({
				ownerItemId: "owner",
				runtime,
				query,
			});
			expect(availability.availableQuantity).toBe(expected.length * 2);
			const detail = yield* readItemLineInputsFx({
				ownerItemId: "owner",
				runtime,
				line,
			});
			expect(detail[0]).toMatchObject({
				availableQuantity: expected.length * 2,
				canAutofill: true,
			});
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
});
it("allocates same-definition instances by each slot's reach without double spending shared stock", () => {
	const queries: QuerySchema.Type[] = [
		{
			distance: "near",
			selector,
		},
		{
			distance: "far" as const,
			selector,
		},
		{
			distance: "near",
			selector,
		},
		{
			distance: "near",
			selector,
		},
	];
	Effect.runSync(
		Effect.gen(function* () {
			yield* spawnFx;
			const runtime = yield* readRuntimeFx();
			const plan = yield* planLineInputAutofillFx({
				...target,
				runtime,
			});
			expect(plan.entry).toEqual([
				{
					inputIndex: 0,
					sourceItemId: "near",
					quantity: 1,
				},
				{
					inputIndex: 2,
					sourceItemId: "near",
					quantity: 1,
				},
				{
					inputIndex: 1,
					sourceItemId: "close",
					quantity: 1,
				},
			]);
			expect(plan.remainingMissingQuantity).toBe(1);
		}).pipe(
			useGameFx({
				config: configFn(queries),
			}),
		),
	);
});
it("keeps delivery remainder visibility tied to its origin and accepts manual material outside autofill reach", () => {
	const query = {
		distance: "close" as const,
		selector,
	} as const;
	Effect.runSync(
		Effect.gen(function* () {
			yield* spawnFx;
			expect(
				yield* autofillLineInputFx({
					...target,
					inputIndex: 0,
				}),
			).toBe(1);
			const runtime = yield* readRuntimeFx();
			expect(runtime.items.find((item) => item.id === "close")?.location.scope).toBe(
				"delivery",
			);
			expect(
				(yield* readItemDetailMaterialAutofillAvailabilityFx({
					ownerItemId: "owner",
					runtime,
					query,
				})).availableQuantity,
			).toBe(1);
			expect(
				(yield* readItemDetailMaterialAutofillAvailabilityFx({
					ownerItemId: "owner",
					runtime,
					query: {
						distance: "far" as const,
						selector,
					},
				})).availableQuantity,
			).toBe(5);
			const source = runtime.items.find((item) => item.id === "far")!;
			yield* storeInputMaterialFx({
				...target,
				inputIndex: 0,
				sourceItemId: source.id,
				sourceItemRevision: source.revision,
				quantity: 1,
			});
			const stored = yield* readRuntimeFx();
			expect(
				stored.items
					.filter((item) => item.location.scope === "input")
					.map((item) => item.quantity),
			).toEqual([
				1,
			]);
		}).pipe(
			useGameFx({
				config: configFn([
					query,
				]),
			}),
		),
	);
});
it("fills a narrow minimum before a broad earlier slot can steal its only source", () => {
	const config = configFn([
		{
			distance: "far" as const,
			selector,
		},
		{
			distance: "close",
			selector,
		},
	]);
	Effect.runSync(
		Effect.gen(function* () {
			yield* spawnItemFx({
				id: "owner",
				itemId: "workshop",
				location: workshopLocation,
				quantity: 1,
			});
			yield* spawnItemFx({
				id: "close",
				itemId: "water",
				location: sourceLocation(1),
				quantity: 1,
			});
			yield* spawnItemFx({
				id: "far",
				itemId: "water",
				location: sourceLocation(3),
				quantity: 1,
			});
			const runtime = yield* readRuntimeFx();
			const plan = yield* planLineInputAutofillFx({
				...target,
				runtime,
			});
			expect(plan.entry).toEqual([
				{
					inputIndex: 1,
					sourceItemId: "close",
					quantity: 1,
				},
				{
					inputIndex: 0,
					sourceItemId: "far",
					quantity: 1,
				},
			]);
			expect(plan.remainingMissingQuantity).toBe(0);
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
});
