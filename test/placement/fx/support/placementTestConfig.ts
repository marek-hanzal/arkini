import type { DropSchema } from "~/v1/output/schema/DropSchema";
import type { OutputSchema } from "~/v1/output/schema/OutputSchema";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";

const simpleItem = ({
	id,
	maxCount,
	maxStackSize,
	scope,
}: {
	id: string;
	maxCount?: number;
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
		maxCount,
		maxStackSize,
		type: "simple",
	} as const;
};

export const placementTestConfig = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:placement",
		title: "Placement",
		board: {
			width: 4,
			height: 1,
		},
		inventory: {
			width: 2,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
	},
	categories: {},
	items: {
		origin: simpleItem({
			id: "origin",
			maxStackSize: 1,
			scope: "board",
		}),
		blocker: simpleItem({
			id: "blocker",
			maxStackSize: 1,
			scope: "any",
		}),
		log: simpleItem({
			id: "log",
			maxStackSize: 3,
			scope: "any",
		}),
		"board-only": simpleItem({
			id: "board-only",
			maxStackSize: 1,
			scope: "board",
		}),
		"inventory-only": simpleItem({
			id: "inventory-only",
			maxStackSize: 2,
			scope: "inventory",
		}),
		limited: simpleItem({
			id: "limited",
			maxCount: 2,
			maxStackSize: 2,
			scope: "any",
		}),
		replacement: simpleItem({
			id: "replacement",
			maxStackSize: 3,
			scope: "any",
		}),
		permit: simpleItem({
			id: "permit",
			maxStackSize: 1,
			scope: "any",
		}),
	},
});

export const boardLocation = (x: number) => {
	return {
		space: 0,
		position: {
			x,
			y: 0,
		},
		scope: "board" as const,
	};
};

export const inventoryLocation = (x: number) => {
	return {
		position: {
			x,
			y: 0,
		},
		scope: "inventory" as const,
	};
};

export const configuredDrop = ({
	itemId,
	placement,
	quantity,
	rules = [],
}: {
	itemId: string;
	placement: DropSchema.Type["placement"];
	quantity: number;
	rules?: DropSchema.Type["rules"];
}) => {
	return {
		itemId,
		placement,
		quantity: {
			type: "value",
			value: quantity,
		},
		rules,
	} satisfies DropSchema.Type;
};

export const configuredOutput = (
	drop: [
		DropSchema.Type,
		...DropSchema.Type[],
	],
) => {
	return {
		set: [
			{
				roll: [
					{
						drop,
						type: "guaranteed",
					},
				],
			},
		],
	} satisfies OutputSchema.Type;
};
