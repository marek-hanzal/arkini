import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";

const baseItem = ({
	id,
	maxStackSize,
	scope,
}: {
	id: string;
	maxStackSize: number;
	scope: "any" | "board" | "inventory";
}) => {
	return {
		id,
		title: id,
		description: id,
		asset: {
			source: [
				`asset:${id}`,
			],
		},
		tags: [],
		categoryId: "resource",
		scope,
		maxStackSize,
	} as const;
};

export const inputRuntimeTestConfig = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:input-runtime",
		title: "Input runtime",
		board: {
			width: 5,
			height: 2,
		},
		inventory: {
			width: 3,
			height: 1,
		},
	},
	start: {},
	categories: {},
	items: {
		workshop: {
			...baseItem({
				id: "workshop",
				maxStackSize: 10,
				scope: "any",
			}),
			type: "producer",
			lines: [
				{
					id: "line:workshop:build",
					title: "Build",
					description: "Build something.",
					runtimeMs: 1_000,
					input: [
						{
							type: "materials",
							selector: {
								type: "item",
								itemId: "water",
							},
							quantity: {
								type: "value",
								value: 3,
							},
							capacity: 2,
						},
						{
							type: "simple",
						},
					],
					rules: [],
				},
			],
		},
		water: {
			...baseItem({
				id: "water",
				maxStackSize: 10,
				scope: "any",
			}),
			type: "simple",
		},
		stone: {
			...baseItem({
				id: "stone",
				maxStackSize: 10,
				scope: "any",
			}),
			type: "simple",
			charges: {
				amount: 2,
			},
		},
	},
});

export const workshopLocation = {
	scope: "board" as const,
	position: {
		x: 0,
		y: 0,
	},
};

export const sourceLocation = (x: number) => {
	return {
		scope: "board" as const,
		position: {
			x,
			y: 0,
		},
	};
};
