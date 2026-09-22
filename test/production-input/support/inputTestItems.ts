import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";

const simpleItem = ({ id }: { id: string }) => {
	return ItemSchema.parse({
		maxQueueSize: 1,
		lines: [],

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
	});
};

export const inputTestItems = {
	water: simpleItem({
		id: "item:water",
	}),
	log: simpleItem({
		id: "item:log",
	}),
};

export const runtimeInputTestItem = ({
	id,
	itemId,
}: {
	id: string;
	itemId: keyof typeof inputTestItems;
}) => {
	return {
		id,
		item: inputTestItems[itemId],
		location: {
			scope: "board" as const,
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		},

		revision: `revision:${id}`,
	} satisfies RuntimeItemSchema.Type;
};
