import { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const itemBase = (id: string, scope: "any" | "board" = "any") => ({
	uid: id,
	id,
	title: id,
	description: id,
	scope,
});

const materialInput = (quantity: number, capacity?: number) => ({
	type: "materials",
	selector: {
		type: "item",
		itemId: "material",
	},
	quantity: {
		min: quantity,
		max: quantity,
	},
	...(capacity === undefined
		? {}
		: {
				capacity,
			}),
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
		hero: "asset:hero",
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
			...itemBase("material"),
			type: "simple",
			asset: {
				scale: 0.8,
				default: [
					"asset:material-primary",
				],
			},
			maxStackSize: 10,
		},
		craft: {
			...itemBase("craft"),
			type: "craft",
			asset: {
				scale: 0.8,
				default: [
					"asset:craft",
				],
			},
			maxStackSize: 1,
			charges: {
				amount: 1,
			},
			line: productionLine("craft", [
				materialInput(6, 3),
			]),
		},
		blueprint: {
			...itemBase("blueprint"),
			type: "blueprint",
			asset: {
				scale: 0.8,
				default: [
					"asset:blueprint-base",
					"asset:blueprint-overlay",
				],
			},
			maxStackSize: 1,
			charges: {
				amount: 1,
			},
			line: productionLine("blueprint", [
				materialInput(3),
				materialInput(3),
			]),
		},
		temporary: {
			...itemBase("temporary", "board"),
			type: "temporary",
			asset: {
				scale: 0.8,
				default: [
					"asset:temporary",
				],
			},
			durationMs: 1_000,
		},
	},
});

const craftItem = tileActorTestConfig.items.craft;
const blueprintItem = tileActorTestConfig.items.blueprint;
if (craftItem.type !== "craft" || blueprintItem.type !== "blueprint") {
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
	return RuntimeSchema.parse({
		cheats: {
			enabled: false,
			everEnabled: false,
			instantGameplay: false,
		},
		currentSpace: 0,
		items: [
			{
				id: "runtime:owner",
				revision: "revision:owner",
				item: {
					...ownerItem,
					asset: {
						...ownerItem.asset,
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
						lineId: ownerItem.line.id,
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
				lineId: ownerItem.line.id,
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
			instantGameplay: false,
		},
		currentSpace: 0,
		items: [
			{
				id: "runtime:temporary",
				revision: "revision:temporary",
				item: tileActorTestConfig.items.temporary,
				location: boardLocation,
				quantity: 1,
				remainingDurationMs,
			},
		],
		jobs: [],
		jobQueue: [],
		defaultLineByOwnerItemId: {},
	});

export const tileActorGame = {
	getResourceUrlFn: (resourceId: string) => `resource:${resourceId}`,
};
