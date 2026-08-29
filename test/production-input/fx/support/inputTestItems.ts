import { SimpleSchema } from "~/item-definition/schema/SimpleSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

const simpleItem = ({ id }: { id: string }) => {
	return SimpleSchema.parse({
		uid: id,
		id,
		title: id,
		description: id,
		asset: {
			default: [
				`asset:${id}`,
			],
		},
		scope: "any",
		maxStackSize: 10,
		type: "simple",
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
			scope: "inventory",
			position: {
				x: 0,
				y: 0,
			},
		},
		quantity,
		revision: `revision:${id}`,
	} satisfies RuntimeItemSchema.Type;
};
