import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const baseItem = ({ id }: { id: string }) => {
	return {
		uid: id,
		id,
		title: id,
		description: id,
		artwork: {
			scale: 0.8,
			default: [
				`artwork:${id}`,
			],
		},
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
	},
	start: {
		currentSpace: 0,
	},
	items: {
		workshop: {
			maxQueueSize: 1,

			...baseItem({
				id: "workshop",
			}),

			lines: [
				{
					id: "line:workshop:build",
					title: "Build",
					description: "Build something.",
					runtimeMs: 1_000,
					input: [
						{
							type: "materials",
							query: {
								distance: "far" as const,
								selector: {
									type: "item",
									itemId: "water",
								},
							},
							quantity: {
								min: 3,
								max: 3,
							},
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
			}),
		},
		stone: {
			maxQueueSize: 1,
			lines: [],

			...baseItem({
				id: "stone",
			}),

			units: {
				amount: 2,
			},
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
