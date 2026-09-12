import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

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
		uid: id,
		id,
		title: id,
		description: id,
		asset: {
			scale: 0.8,
			default: [
				`asset:${id}`,
			],
		},
		scope,
		maxStackSize,
	} as const;
};

export const inputRuntimeTestConfig = GameConfigSchema.parse({
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
	start: {
		currentSpace: 0,
	},
	items: {
		workshop: {
			maxQueueSize: 1,

			...baseItem({
				id: "workshop",
				maxStackSize: 10,
				scope: "any",
			}),
			type: "common",
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
								min: 3,
								max: 3,
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
			maxQueueSize: 1,
			lines: [],

			...baseItem({
				id: "water",
				maxStackSize: 10,
				scope: "any",
			}),
			type: "common",
		},
		stone: {
			maxQueueSize: 1,
			lines: [],

			...baseItem({
				id: "stone",
				maxStackSize: 10,
				scope: "any",
			}),
			type: "common",
			units: {
				amount: 2,
			},
		},
	},
});

export const inputRuntimeToolbarTestConfig = GameConfigSchema.parse({
	...inputRuntimeTestConfig,
	meta: {
		...inputRuntimeTestConfig.meta,
		toolbarSize: 3,
	},
	items: {
		...inputRuntimeTestConfig.items,
		inventory: {
			...baseItem({
				id: "inventory",
				maxStackSize: 1,
				scope: "board",
			}),
			type: "inventory",
		},
	},
});

export const workshopLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};

export const sourceLocation = (x: number) => {
	return {
		scope: "board" as const,
		space: 0,
		position: {
			x,
			y: 0,
		},
	};
};
