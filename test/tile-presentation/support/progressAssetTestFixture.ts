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

export const progressAssetTestConfig = GameConfigSchema.parse({
	resources: {
		hero: "asset:hero",
	},
	meta: {
		id: "game:progress-assets",
		title: "Progress assets",
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
				default: [
					"asset:material-primary",
					"asset:material-unused-stage",
				],
			},
			maxStackSize: 10,
		},
		craft: {
			...itemBase("craft"),
			type: "craft",
			asset: {
				default: [
					"asset:stage-0",
				],
				sources: [
					"asset:stage-1",
					"asset:stage-2",
					"asset:stage-3",
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
				default: [
					"asset:blueprint-empty",
					"asset:blueprint-complete",
				],
				sources: [
					"asset:blueprint-complete",
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
				default: [
					"asset:temporary",
				],
			},
			durationMs: 1_000,
		},
	},
});

const craftItem = progressAssetTestConfig.items.craft;
const blueprintItem = progressAssetTestConfig.items.blueprint;
if (craftItem.type !== "craft" || blueprintItem.type !== "blueprint") {
	throw new Error("Invalid progress asset test config.");
}

const boardLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};

export const createProgressAssetRuntime = ({
	active = false,
	owner = "craft",
	queued = 0,
	storedQuantity = 0,
	storedQuantities,
}: {
	readonly active?: boolean;
	readonly owner?: "blueprint" | "craft";
	readonly queued?: number;
	readonly storedQuantity?: number;
	readonly storedQuantities?: ReadonlyArray<number>;
} = {}) => {
	const ownerItem = owner === "craft" ? craftItem : blueprintItem;
	const inputQuantities = storedQuantities ?? [
		storedQuantity,
	];
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
				item: ownerItem,
				location: boardLocation,
				quantity: 1,
			},
			...inputQuantities.flatMap((quantity, inputIndex) =>
				quantity === 0
					? []
					: [
							{
								id: `runtime:material:${inputIndex}`,
								revision: `revision:material:${inputIndex}:${quantity}`,
								item: progressAssetTestConfig.items.material,
								location: {
									scope: "input" as const,
									ownerItemId: "runtime:owner",
									lineId: ownerItem.line.id,
									inputIndex,
								},
								quantity,
							},
						],
			),
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

export const readProgressAssetOwner = (runtime: RuntimeSchema.Type) => {
	const owner = runtime.items.find((item) => item.id === "runtime:owner");
	if (owner === undefined) throw new Error("Missing progress owner.");
	return owner;
};

export const createTemporaryProgressRuntime = () =>
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
				item: progressAssetTestConfig.items.temporary,
				location: boardLocation,
				quantity: 1,
				remainingDurationMs: 600,
			},
		],
		jobs: [],
		jobQueue: [],
		defaultLineByOwnerItemId: {},
	});

export const progressAssetGame = {
	getResourceUrlFn: (resourceId: string) => `resource:${resourceId}`,
};
