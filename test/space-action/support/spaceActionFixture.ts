import { Effect, type Layer } from "effect";

import { useGameFx } from "~test/support/useGameFx";
import type { GameLayerFx } from "~test/support/GameLayerFx";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { activateItemActionFx } from "~/item-action/fx/activateItemActionFx";

const baseItem = (id: string) => ({
	uid: `uid:${id}`,
	id,
	title: id,
	description: id,
	artwork: {
		scale: 0.8,
		default: [
			"hero",
		] as [
			string,
		],
	},
	maxStackSize: 4,
});

const depletionOutput = (itemId: string) => ({
	set: [
		{
			rules: [],
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

const config = GameConfigSchema.parse({
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
	},
	start: {
		currentSpace: 0,
	},
	items: {
		sameSpacePortal: {
			...baseItem("sameSpacePortal"),

			action: {
				type: "space" as const,
				space: 0,
			},
		},
		portal: {
			...baseItem("portal"),

			action: {
				type: "space" as const,
				space: 7,
			},
		},
		blockedPortal: {
			...baseItem("blockedPortal"),

			action: {
				type: "space" as const,
				space: 2,
				rules: [
					{
						type: "enable",
						when: [
							{
								type: "exists",
								query: {
									distance: "universe",
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
		},
		proximityPortal: {
			...baseItem("proximityPortal"),

			action: {
				type: "space" as const,
				space: 10,
				rules: [
					{
						type: "enable",
						when: [
							{
								type: "exists",
								query: {
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
		},
		unitsPortal: {
			...baseItem("unitsPortal"),

			action: {
				type: "space" as const,
				space: 3,
				input: [
					{
						type: "units",
						query: {
							distance: "close",
							selector: {
								type: "item",
								itemId: "payer",
							},
						},
						units: {
							from: "target",
							cost: 1,
						},
					},
				],
			},
		},
		ownerUnitsPortal: {
			...baseItem("ownerUnitsPortal"),

			action: {
				type: "space" as const,
				space: 8,
				input: [
					{
						type: "units",
						query: {
							distance: "close",
							selector: {
								type: "item",
								itemId: "payer",
							},
						},
						units: {
							from: "self",
							cost: 1,
						},
					},
				],
			},

			units: {
				amount: 3,
			},
		},
		spentPortal: {
			...baseItem("spentPortal"),

			action: {
				type: "space" as const,
				space: 4,
			},

			units: {
				amount: 2,
			},
		},
		passiveFinitePortal: {
			...baseItem("passiveFinitePortal"),

			action: {
				type: "space" as const,
				space: 4,
				input: [
					{
						type: "simple",
						units: {
							from: "self",
							cost: 1,
						},
					},
				],
			},

			units: {
				amount: 2,
			},
		},
		cumulativePortal: {
			...baseItem("cumulativePortal"),

			action: {
				type: "space" as const,
				space: 5,
				input: [
					{
						type: "simple",
						units: {
							from: "self",
							cost: 1,
						},
					},
					{
						type: "simple",
						units: {
							from: "self",
							cost: 1,
						},
					},
				],
			},

			units: {
				amount: 2,
			},
		},
		depletingPortal: {
			...baseItem("depletingPortal"),

			action: {
				type: "space" as const,
				space: 6,
				input: [
					{
						type: "simple",
						units: {
							from: "self",
							cost: 1,
						},
					},
				],
			},

			units: {
				amount: 1,
				output: depletionOutput("token"),
			},
		},
		passiveFailurePortal: {
			...baseItem("passiveFailurePortal"),

			action: {
				type: "space" as const,
				space: 9,
				input: [
					{
						type: "simple",
						units: {
							from: "self",
							cost: 1,
						},
					},
				],
			},

			units: {
				amount: 1,
				output: {
					set: [
						{
							rules: [],
							roll: [
								{
									type: "guaranteed",
									drop: [
										{
											itemId: "boardToken",
											rules: [],
											quantity: {
												min: 2,
												max: 2,
											},
											placement: "drop",
										},
									],
								},
							],
						},
					],
				},
			},
		},
		payer: {
			maxQueueSize: 1,
			lines: [],

			...baseItem("payer"),

			units: {
				amount: 2,
			},
		},
		permit: {
			maxQueueSize: 1,
			lines: [],

			...baseItem("permit"),
		},
		token: {
			maxQueueSize: 1,
			lines: [],

			...baseItem("token"),
		},
		boardToken: {
			maxQueueSize: 1,
			lines: [],

			...baseItem("boardToken"),
			maxStackSize: 1,
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
	location: BoardLocationSchema.Type;
	quantity?: number;
}) {
	const item = yield* spawnItemFx({
		id,
		itemId,
		location,
		quantity,
	});
	const runtime = yield* readRuntimeFx();
	const space = yield* activateItemActionFx({
		currentSpace: runtime.currentSpace,
		itemId: item.id,
		location: item.location as BoardLocationSchema.Type,
		revision: item.revision,
	});
	return {
		item,
		runtime: yield* readRuntimeFx(),
		space,
	};
});
