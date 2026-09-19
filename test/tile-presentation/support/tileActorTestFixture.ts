import { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const itemBase = (id: string, scope: "any" | "board" = "any") => ({
	uid: id,
	id,
	title: id,
	description: id,
	scope,
});

const materialInput = (quantity: number) => ({
	type: "materials",
	query: {
		scope: "any",
		selector: {
			type: "item",
			itemId: "material",
		},
	},
	quantity: {
		min: quantity,
		max: quantity,
	},
});

const productionLine = (id: string, input: ReadonlyArray<ReturnType<typeof materialInput>>) => ({
	id: `line:${id}`,
	title: id,
	description: id,
	runtimeMs: 1_000,
	input,
	rules: [],
});

export const tileActorTestConfig = GameConfigSchema.parse({
	resources: {
		hero: "artwork:hero",
	},
	meta: {
		id: "game:tile-actors",
		title: "Tile actors",
		board: {
			width: 2,
			height: 1,
		},
		inventory: {
			width: 1,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
	},
	items: {
		material: {
			maxQueueSize: 1,
			lines: [],

			...itemBase("material"),

			artwork: {
				scale: 0.8,
				default: [
					"artwork:material-primary",
				],
			},
			maxStackSize: 10,
		},
		craft: {
			maxQueueSize: 1,

			...itemBase("craft"),

			artwork: {
				scale: 0.8,
				default: [
					"artwork:craft",
				],
			},
			maxStackSize: 1,
			units: {
				amount: 1,
			},
			lines: [
				productionLine("craft", [
					materialInput(6),
				]),
			],
		},
		blueprint: {
			...itemBase("blueprint"),

			artwork: {
				scale: 0.8,
				default: [
					"artwork:blueprint-base",
					"artwork:blueprint-overlay",
				],
			},
			maxStackSize: 1,
			units: {
				amount: 1,
			},
			lines: [
				{
					...productionLine("blueprint", [
						materialInput(3),
						materialInput(3),
					]),
				},
			],
		},
		temporary: {
			...itemBase("temporary", "board"),
			maxStackSize: 1,

			lines: [],
			maxQueueSize: 1,
			artwork: {
				scale: 0.8,
				default: [
					"artwork:temporary",
				],
			},
			clock: {
				durationMs: 1_000,
			},
		},
	},
});

const craftItem = tileActorTestConfig.items.craft;
const blueprintItem = tileActorTestConfig.items.blueprint;
if (craftItem === undefined || blueprintItem === undefined) {
	throw new Error("Invalid tile actor test config.");
}

const boardLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};

export const createTileActorRuntime = ({
	active = false,
	artworkScale = 0.8,
	owner = "craft",
	queued = 0,
}: {
	readonly active?: boolean;
	readonly artworkScale?: number;
	readonly owner?: "blueprint" | "craft";
	readonly queued?: number;
} = {}) => {
	const ownerItem = owner === "craft" ? craftItem : blueprintItem;
	const ownerLine = ownerItem.lines[0];
	return RuntimeSchema.parse({
		cheats: {
			enabled: false,
			everEnabled: false,
			speedUpGameplay: false,
		},
		currentSpace: 0,
		items: [
			{
				id: "runtime:owner",
				revision: "revision:owner",
				item: {
					...ownerItem,
					artwork: {
						...ownerItem.artwork,
						scale: artworkScale,
					},
				},
				location: boardLocation,
				quantity: 1,
			},
		],
		jobs: active
			? [
					{
						id: "job:owner",
						ownerItemId: "runtime:owner",
						lineId: ownerLine.id,
						durationMs: 1_000,
						remainingMs: 500,
					},
				]
			: [],
		jobQueue: Array.from(
			{
				length: queued,
			},
			(_, index) => ({
				id: `job:queue:${index}`,
				ownerItemId: "runtime:owner",
				lineId: ownerLine.id,
			}),
		),
		defaultLineByOwnerItemId: {},
	});
};

export const createTemporaryTileActorRuntime = ({
	remainingDurationMs = 600,
}: {
	readonly remainingDurationMs?: number;
} = {}) =>
	RuntimeSchema.parse({
		cheats: {
			enabled: false,
			everEnabled: false,
			speedUpGameplay: false,
		},
		currentSpace: 0,
		items: [
			{
				id: "runtime:temporary",
				revision: "revision:temporary",
				item: tileActorTestConfig.items.temporary,
				location: boardLocation,
				quantity: 1,
				schedule: {
					remainingDurationMs,
				},
			},
		],
		jobs: [],
		jobQueue: [],
		defaultLineByOwnerItemId: {},
	});

export const tileActorGame = {
	getResourceUrlFn: (resourceId: string) => `resource:${resourceId}`,
};
