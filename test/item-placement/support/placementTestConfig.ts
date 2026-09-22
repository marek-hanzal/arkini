import type { DropSchema } from "~/production-output/schema/DropSchema";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const simpleItem = ({ id, maxStackSize }: { id: string; maxStackSize: number }) => {
	return {
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
		maxStackSize,
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
	},
	items: {
		origin: simpleItem({
			id: "origin",
			maxStackSize: 1,
		}),
		blocker: simpleItem({
			id: "blocker",
			maxStackSize: 1,
		}),
		log: simpleItem({
			id: "log",
			maxStackSize: 3,
		}),
		"board-only": simpleItem({
			id: "board-only",
			maxStackSize: 1,
		}),
		limited: simpleItem({
			id: "limited",
			maxStackSize: 2,
		}),
		replacement: simpleItem({
			id: "replacement",
			maxStackSize: 3,
		}),
		permit: simpleItem({
			id: "permit",
			maxStackSize: 1,
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
	placement: DropSchema.Type["placement"];
	quantity: number;
	rules?: DropSchema.Type["rules"];
}) => {
	return {
		itemId,
		placement,
		quantity: {
			min: quantity,
			max: quantity,
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
				weight: 1,
				rules: [],
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
