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
		maxStackSize: 10,
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
	quantity,
}: {
	id: string;
	itemId: keyof typeof inputTestItems;
	quantity: number;
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
		quantity,
		revision: `revision:${id}`,
	} satisfies RuntimeItemSchema.Type;
};
