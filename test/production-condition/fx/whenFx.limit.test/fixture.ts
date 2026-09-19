import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const itemFn = (id: string) => ({
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
	scope: "any",
	maxStackSize: 3,
	lines: [],
});

export const limitWhen = {
	type: "limit",
	itemId: "token",
} as const;
const disableRule = {
	type: "disable",
	when: [
		limitWhen,
	],
};
const materialFn = (mode: "consume" | "reserve") => ({
	type: "materials",
	mode,
	query: {
		scope: "any",
		selector: {
			type: "item",
			itemId: "token",
		},
	},
	quantity: {
		min: 1,
		max: 1,
	},
});

export const limitConfig = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:limit-condition",
		title: "Limit condition",
		board: {
			width: 6,
			height: 2,
		},
		inventory: {
			width: 2,
			height: 1,
		},
		toolbarSize: 2,
	},
	start: {
		currentSpace: 0,
	},
	items: {
		token: {
			...itemFn("token"),
			maxCount: 3,
		},
		uncapped: itemFn("uncapped"),
		producer: {
			...itemFn("producer"),
			maxStackSize: 1,
			lines: [
				{
					id: "produce",
					title: "Produce",
					description: "Produce",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					rules: [
						disableRule,
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
												itemId: "token",
												quantity: {
													min: 1,
													max: 1,
												},
												placement: "drop",
												rules: [
													disableRule,
												],
											},
										],
									},
								],
							},
						],
					},
				},
			],
		},
		consumer: {
			...itemFn("consumer"),
			maxStackSize: 1,
			lines: [
				{
					id: "consume",
					title: "Consume",
					description: "Consume",
					runtimeMs: 1000,
					input: [
						materialFn("consume"),
						materialFn("reserve"),
					],
					rules: [],
				},
			],
		},
	},
});
