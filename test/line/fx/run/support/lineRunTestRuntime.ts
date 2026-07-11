import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

const baseItem = ({ id, scope }: { id: string; scope: "any" | "board" }) => {
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
		maxStackSize: 10,
	} as const;
};

const existsWhen = (itemId: string) => {
	return {
		type: "exists" as const,
		query: {
			scope: "any" as const,
			selector: {
				type: "item" as const,
				itemId,
			},
		},
	};
};

export const lineRunTestConfig = GameConfigSchema.parse({
	version: "1.0",
	meta: {
		id: "game:line-run",
		title: "Line run",
		board: {
			width: 5,
			height: 2,
		},
		inventory: {
			width: 5,
			height: 1,
		},
	},
	start: {},
	categories: {},
	items: {
		workshop: {
			...baseItem({
				id: "workshop",
				scope: "board",
			}),
			maxStackSize: 1,
			type: "producer",
			maxQueueSize: 2,
			lines: [
				{
					id: "line:workshop:build",
					title: "Build",
					description: "Build something.",
					show: false,
					enable: false,
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
					rules: [
						{
							type: "show",
							when: [
								existsWhen("permit"),
							],
						},
						{
							type: "hide",
							when: [
								existsWhen("blocker"),
							],
						},
						{
							type: "enable",
							when: [
								existsWhen("permit"),
							],
						},
						{
							type: "disable",
							when: [
								existsWhen("blocker"),
							],
						},
						{
							type: "runtime:multiplier",
							when: [
								existsWhen("booster"),
							],
							multiplier: 0.5,
						},
					],
				},
			],
		},
		water: {
			...baseItem({
				id: "water",
				scope: "any",
			}),
			type: "simple",
		},
		permit: {
			...baseItem({
				id: "permit",
				scope: "any",
			}),
			type: "simple",
		},
		booster: {
			...baseItem({
				id: "booster",
				scope: "any",
			}),
			type: "simple",
		},
		blocker: {
			...baseItem({
				id: "blocker",
				scope: "any",
			}),
			type: "simple",
		},
	},
});

const ownerItem = {
	id: "runtime:workshop",
	item: lineRunTestConfig.items.workshop,
	location: {
		scope: "board",
		position: {
			x: 0,
			y: 0,
		},
	},
	quantity: 1,
} satisfies RuntimeItemSchema.Type;

const gridItem = ({
	id,
	itemId,
	x,
}: {
	id: string;
	itemId: "blocker" | "booster" | "permit";
	x: number;
}) => {
	return {
		id,
		item: lineRunTestConfig.items[itemId],
		location: {
			scope: "inventory",
			position: {
				x,
				y: 0,
			},
		},
		quantity: 1,
	} satisfies RuntimeItemSchema.Type;
};

const bufferedWater = ({ id, quantity }: { id: string; quantity: number }) => {
	return {
		id,
		item: lineRunTestConfig.items.water,
		location: {
			scope: "input",
			ownerItemId: ownerItem.id,
			lineId: "line:workshop:build",
			inputIndex: 0,
			returnLocation: {
				scope: "inventory",
				position: {
					x: 4,
					y: 0,
				},
			},
		},
		quantity,
	} satisfies RuntimeItemSchema.Type;
};

export const lineRunRuntime = ({
	blocker = false,
	booster = false,
	permit = false,
	water = [],
}: {
	blocker?: boolean;
	booster?: boolean;
	permit?: boolean;
	water?: number[];
}) => {
	const items: RuntimeItemSchema.Type[] = [
		ownerItem,
	];

	if (permit) {
		items.push(
			gridItem({
				id: "runtime:permit",
				itemId: "permit",
				x: 1,
			}),
		);
	}
	if (booster) {
		items.push(
			gridItem({
				id: "runtime:booster",
				itemId: "booster",
				x: 2,
			}),
		);
	}
	if (blocker) {
		items.push(
			gridItem({
				id: "runtime:blocker",
				itemId: "blocker",
				x: 3,
			}),
		);
	}
	water.forEach((quantity, index) => {
		items.push(
			bufferedWater({
				id: `runtime:water:${index}`,
				quantity,
			}),
		);
	});

	return {
		items,
	} satisfies RuntimeSchema.Type;
};
