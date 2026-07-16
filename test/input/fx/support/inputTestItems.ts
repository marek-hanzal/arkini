import { SimpleItemSchema } from "~/engine/item/schema/SimpleItemSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

const simpleItem = ({ id, tags }: { id: string; tags: string[] }) => {
	return SimpleItemSchema.parse({
		id,
		title: id,
		description: id,
		asset: {
			source: [
				`asset:${id}`,
			],
		},
		tags,
		categoryId: "resource",
		scope: "any",
		maxStackSize: 10,
		type: "simple",
	});
};

export const inputTestItems = {
	water: simpleItem({
		id: "item:water",
		tags: [
			"liquid",
		],
	}),
	log: simpleItem({
		id: "item:log",
		tags: [
			"wood",
		],
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
