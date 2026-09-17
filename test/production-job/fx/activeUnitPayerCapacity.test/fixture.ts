import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { spawnItemFx } from "~test/support/spawnItemFx";

const item = (id: string) => ({
	id,
	uid: id,
	title: id,
	description: id,
	artwork: {
		scale: 0.8,
		default: [
			`artwork:${id}`,
		],
	},
	scope: "board",
	maxStackSize: 1,
});
const output = (itemId: string) => ({
	set: [
		{
			rules: [],
			roll: [
				{
					type: "guaranteed",
					drop: [
						{
							itemId,
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
});
export const config = (consumedDepletion = false) =>
	GameConfigSchema.parse({
		resources: {
			hero: "hero",
		},
		meta: {
			id: "active-unit-payer",
			title: "Active unit payer",
			board: {
				width: 4,
				height: 3,
			},
			inventory: {
				width: 1,
				height: 1,
			},
		},
		start: {
			currentSpace: 0,
		},
		items: {
			payer: {
				...item("payer"),
				maxCount: 1,
				units: {
					amount: 1,
					output: consumedDepletion ? output("material") : undefined,
				},
				lines: [
					{
						id: "work",
						title: "Work",
						description: "Work",
						runtimeMs: 10000,
						rules: [],
						input: consumedDepletion
							? [
									{
										type: "materials",
										mode: "consume",
										selector: {
											type: "item",
											itemId: "material",
										},
										quantity: {
											min: 1,
											max: 1,
										},
									},
								]
							: [
									{
										type: "simple",
									},
								],
					},
				],
			},
			maker: {
				...item("maker"),
				lines: [
					{
						id: "make",
						title: "Make",
						description: "Make",
						runtimeMs: 1000,
						rules: [],
						input: [
							{
								type: "units",
								units: {
									from: "target",
									cost: 1,
								},
								query: {
									scope: "board",
									distance: "far",
									selector: {
										type: "item",
										itemId: "payer",
									},
								},
							},
						],
						output: consumedDepletion ? undefined : output("payer"),
					},
				],
			},
			material: {
				...item("material"),
				maxCount: 1,
				lines: [],
			},
		},
	});
export const spawn = (itemId: string, x: number) =>
	spawnItemFx({
		id: `runtime:${itemId}`,
		itemId,
		quantity: 1,
		location: {
			scope: "board",
			space: 0,
			position: {
				x,
				y: 0,
			},
		},
	});
export const payerRequest = {
	ownerItemId: "runtime:payer",
	lineId: "work",
};
export const makerRequest = {
	ownerItemId: "runtime:maker",
	lineId: "make",
};
