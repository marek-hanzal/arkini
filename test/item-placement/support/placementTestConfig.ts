import type { ItemOutcomeSchema } from "~/outcome/schema/ItemOutcomeSchema";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const simpleItem = ({ id }: { id: string }) => {
	return {
		maxQueueSize: 1,
		lines: [],

		uid: id,

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

export const placementTestConfig = GameConfigSchema.parse({
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
	},
	start: {
		currentSpace: 0,
		spaces: [],
	},
	items: {
		origin: simpleItem({
			id: "origin",
		}),
		blocker: simpleItem({
			id: "blocker",
		}),
		log: simpleItem({
			id: "log",
		}),
		"board-only": simpleItem({
			id: "board-only",
		}),
		limited: simpleItem({
			id: "limited",
		}),
		replacement: simpleItem({
			id: "replacement",
		}),
		permit: simpleItem({
			id: "permit",
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

export const configuredDrop = ({
	itemId,
	placement,
	quantity,
	rules = [],
}: {
	itemId: string;
	placement: ItemOutcomeSchema.Type["placement"];
	quantity: number;
	rules?: ItemOutcomeSchema.Type["rules"];
}) => {
	return {
		type: "item" as const,
		itemUid: itemId,
		placement,
		quantity: {
			min: quantity,
			max: quantity,
		},
		rules,
	} satisfies ItemOutcomeSchema.Type;
};

export const configuredOutput = (
	outcome: [
		ItemOutcomeSchema.Type,
		...ItemOutcomeSchema.Type[],
	],
) => {
	return {
		set: [
			{
				weight: 1,
				rules: [],
				roll: [
					{
						outcome,
						type: "guaranteed",
					},
				],
			},
		],
	} satisfies OutcomeTableSchema.Type;
};
