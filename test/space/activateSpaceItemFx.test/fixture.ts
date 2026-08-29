import { Effect, type Layer } from "effect";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import type { GameLayerFx } from "~/engine/game/layer/GameLayerFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { activateSpaceItemFx } from "~/engine/space/write/activateSpaceItemFx";
import { setCurrentSpaceFx } from "~/engine/space/write/setCurrentSpaceFx";

const baseItem = (id: string, scope: "any" | "board" | "inventory" = "any") => ({
	uid: `uid:${id}`,
	id,
	title: id,
	description: id,
	asset: {
		default: [
			"hero",
		] as [
			string,
		],
	},
	scope,
	maxStackSize: 4,
});

const depletionOutput = (itemId: string) => ({
	set: [
		{
			roll: [
				{
					type: "guaranteed" as const,
					drop: [
						{
							itemId,
							quantity: {
								min: 1,
								max: 1,
							},
							placement: "drop" as const,
							rules: [],
						},
					],
				},
			],
		},
	],
});

export const config = GameConfigSchema.parse({
	resources: {
		hero: "tile",
	},
	meta: {
		id: "game:space-action",
		title: "Space action",
		board: {
			width: 4,
			height: 2,
		},
		inventory: {
			width: 4,
			height: 1,
		},
		toolbarSize: 4,
	},
	start: {
		currentSpace: 0,
	},
	items: {
		portal: {
			...baseItem("portal"),
			type: "space",
			space: 7,
		},
		blockedPortal: {
			...baseItem("blockedPortal"),
			type: "space",
			space: 2,
			rules: [
				{
					type: "enable",
					when: [
						{
							type: "exists",
							query: {
								scope: "universe",
								selector: {
									type: "item",
									itemId: "permit",
								},
							},
						},
					],
				},
			],
		},
		proximityPortal: {
			...baseItem("proximityPortal"),
			type: "space",
			space: 10,
			rules: [
				{
					type: "enable",
					when: [
						{
							type: "exists",
							query: {
								scope: "board",
								distance: "close",
								selector: {
									type: "item",
									itemId: "permit",
								},
							},
						},
					],
				},
			],
		},
		passiveZeroBoardRulePortal: {
			...baseItem("passiveZeroBoardRulePortal", "inventory"),
			type: "space",
			space: 11,
			rules: [
				{
					type: "enable",
					when: [
						{
							type: "count",
							count: 0,
							query: {
								scope: "board",
								distance: "close",
								selector: {
									type: "item",
									itemId: "permit",
								},
							},
						},
					],
				},
			],
		},
		depositPortal: {
			...baseItem("depositPortal"),
			type: "space",
			space: 3,
			input: [
				{
					type: "deposit",
					query: {
						scope: "board",
						distance: "close",
						selector: {
							type: "item",
							itemId: "payer",
						},
					},
					charges: {
						from: "target",
						cost: 1,
					},
				},
			],
		},
		ownerDepositPortal: {
			...baseItem("ownerDepositPortal"),
			type: "space",
			space: 8,
			charges: {
				amount: 3,
			},
			input: [
				{
					type: "deposit",
					query: {
						scope: "board",
						distance: "close",
						selector: {
							type: "item",
							itemId: "payer",
						},
					},
					charges: {
						from: "self",
						cost: 1,
					},
				},
			],
		},
		chargedPortal: {
			...baseItem("chargedPortal"),
			type: "space",
			space: 4,
			charges: {
				amount: 2,
			},
		},
		passiveChargedPortal: {
			...baseItem("passiveChargedPortal"),
			type: "space",
			space: 4,
			charges: {
				amount: 2,
			},
			input: [
				{
					type: "simple",
					charges: {
						from: "self",
						cost: 1,
					},
				},
			],
		},
		cumulativePortal: {
			...baseItem("cumulativePortal"),
			type: "space",
			space: 5,
			charges: {
				amount: 2,
			},
			input: [
				{
					type: "simple",
					charges: {
						from: "self",
						cost: 1,
					},
				},
				{
					type: "simple",
					charges: {
						from: "self",
						cost: 1,
					},
				},
			],
		},
		depletingPortal: {
			...baseItem("depletingPortal"),
			type: "space",
			space: 6,
			charges: {
				amount: 1,
				output: depletionOutput("token"),
			},
			input: [
				{
					type: "simple",
					charges: {
						from: "self",
						cost: 1,
					},
				},
			],
		},
		passiveFailurePortal: {
			...baseItem("passiveFailurePortal", "inventory"),
			type: "space",
			space: 9,
			charges: {
				amount: 1,
				output: depletionOutput("boardToken"),
			},
			input: [
				{
					type: "simple",
					charges: {
						from: "self",
						cost: 1,
					},
				},
			],
		},
		payer: {
			...baseItem("payer", "board"),
			type: "deposit",
			charges: {
				amount: 2,
			},
		},
		permit: {
			...baseItem("permit"),
			type: "simple",
		},
		token: {
			...baseItem("token", "inventory"),
			type: "simple",
		},
		boardToken: {
			...baseItem("boardToken", "board"),
			type: "simple",
		},
	},
});

export const board = (x: number, y = 0, space = 0) =>
	({
		scope: "board",
		space,
		position: {
			x,
			y,
		},
	}) as const;
export const inventory = (x: number) =>
	({
		scope: "inventory",
		position: {
			x,
			y: 0,
		},
	}) as const;
export const toolbar = (x: number) =>
	({
		scope: "toolbar",
		position: {
			x,
			y: 0,
		},
	}) as const;

export const run = <A, E>(
	program: Effect.Effect<A, E, Layer.Success<ReturnType<typeof GameLayerFx>>>,
) =>
	Effect.runSync(
		program.pipe(
			useGameFx({
				config,
			}),
		),
	);

export const spawnAndActivate = Effect.fn("spawnAndActivate")(function* ({
	id,
	itemId,
	location,
	quantity = 1,
}: {
	id: string;
	itemId: string;
	location: GridLocationSchema.Type;
	quantity?: number;
}) {
	const item = yield* spawnItemFx({
		id,
		itemId,
		location,
		quantity,
	});
	const runtime = yield* readRuntimeFx();
	const space = yield* activateSpaceItemFx({
		currentSpace: runtime.currentSpace,
		itemId: item.id,
		location: item.location as GridLocationSchema.Type,
		revision: item.revision,
	});
	return {
		item,
		runtime: yield* readRuntimeFx(),
		space,
	};
});

export { Effect, activateSpaceItemFx, readRuntimeFx, setCurrentSpaceFx, spawnItemFx };
