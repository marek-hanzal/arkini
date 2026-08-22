import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { readTileActorAssetSourceIdsFx } from "~/bridge/tile/readTileActorAssetSourceIdsFx";
import { readTileActorsFx } from "~/bridge/tile/readTileActorsFx";
import { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const config = GameConfigSchema.parse({
	version: "1.0",
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
			uid: "material",
			id: "material",
			type: "simple",
			title: "Material",
			description: "Material",
			asset: {
				default: [
					"asset:material-primary",
					"asset:material-unused-stage",
				],
			},
			scope: "any",
			maxStackSize: 10,
		},
		craft: {
			uid: "craft",
			id: "craft",
			type: "craft",
			title: "Craft",
			description: "Craft",
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
			scope: "any",
			maxStackSize: 1,
			charges: {
				amount: 1,
			},
			line: {
				id: "line:craft",
				title: "Craft",
				description: "Craft",
				runtimeMs: 1_000,
				input: [
					{
						type: "materials",
						selector: {
							type: "item",
							itemId: "material",
						},
						quantity: {
							min: 6,
							max: 6,
						},
						capacity: 3,
					},
				],
				rules: [],
			},
		},
		blueprint: {
			uid: "blueprint",
			id: "blueprint",
			type: "blueprint",
			title: "Blueprint",
			description: "Blueprint",
			asset: {
				default: [
					"asset:blueprint-empty",
					"asset:blueprint-complete",
				],
				sources: [
					"asset:blueprint-complete",
				],
			},
			scope: "any",
			maxStackSize: 1,
			charges: {
				amount: 1,
			},
			line: {
				id: "line:blueprint",
				title: "Blueprint",
				description: "Blueprint",
				runtimeMs: 1_000,
				input: [
					{
						type: "materials",
						selector: {
							type: "item",
							itemId: "material",
						},
						quantity: {
							min: 3,
							max: 3,
						},
					},
					{
						type: "materials",
						selector: {
							type: "item",
							itemId: "material",
						},
						quantity: {
							min: 3,
							max: 3,
						},
					},
				],
				rules: [],
			},
		},
	},
});
const craftItem = config.items.craft;
const blueprintItem = config.items.blueprint;
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

const runtime = ({
	active = false,
	ownerItem = craftItem,
	storedQuantity = 0,
	storedQuantities,
}: {
	readonly active?: boolean;
	readonly ownerItem?: typeof craftItem | typeof blueprintItem;
	readonly storedQuantity?: number;
	readonly storedQuantities?: ReadonlyArray<number>;
}) => {
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
								item: config.items.material,
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
		jobQueue: [],
		defaultLineByOwnerItemId: {},
	});
};

const readAssetId = (nextRuntime: RuntimeSchema.Type) => {
	const owner = nextRuntime.items.find((item) => item.id === "runtime:owner");
	if (owner === undefined) throw new Error("Missing progress owner.");
	return Effect.runSync(
		readTileActorAssetSourceIdsFx({
			item: owner,
			runtime: nextRuntime,
		}),
	);
};

describe("readTileActorAssetSourceIdsFx", () => {
	it.each([
		{
			assetId: "asset:stage-0",
			storedQuantity: 0,
		},
		{
			assetId: "asset:stage-0",
			storedQuantity: 1,
		},
		{
			assetId: "asset:stage-1",
			storedQuantity: 2,
		},
		{
			assetId: "asset:stage-2",
			storedQuantity: 4,
		},
		{
			assetId: "asset:stage-3",
			storedQuantity: 6,
		},
	])("selects $assetId for $storedQuantity of six required materials", ({
		assetId,
		storedQuantity,
	}) => {
		expect(
			readAssetId(
				runtime({
					storedQuantity,
				}),
			),
		).toEqual([
			assetId,
		]);
	});

	it("ignores buffered capacity above the required line quantity", () => {
		expect(
			readAssetId(
				runtime({
					storedQuantity: 9,
				}),
			),
		).toEqual([
			"asset:stage-3",
		]);
	});

	it("keeps the final stage while a job owns the consumed inputs", () => {
		expect(
			readAssetId(
				runtime({
					active: true,
				}),
			),
		).toEqual([
			"asset:stage-3",
		]);
	});

	it("applies the same fill contract to blueprints", () => {
		expect(
			readAssetId(
				runtime({
					ownerItem: blueprintItem,
					storedQuantities: [
						3,
						3,
					],
				}),
			),
		).toEqual([
			"asset:blueprint-complete",
		]);
	});

	it("keeps non-progressive item kinds on their complete authored default", () => {
		const nextRuntime = runtime({});
		const material = {
			...nextRuntime.items[0],
			item: config.items.material,
		};

		expect(
			Effect.runSync(
				readTileActorAssetSourceIdsFx({
					item: material,
					runtime: nextRuntime,
				}),
			),
		).toEqual([
			"asset:material-primary",
			"asset:material-unused-stage",
		]);
	});

	it("keeps the complete blueprint default composition before progress", () => {
		expect(
			readAssetId(
				runtime({
					ownerItem: blueprintItem,
				}),
			),
		).toEqual([
			"asset:blueprint-empty",
			"asset:blueprint-complete",
		]);
	});

	it("projects the selected source URL through the canonical tile actor read", () => {
		const nextRuntime = runtime({
			storedQuantity: 4,
		});
		const game = {
			getResourceUrl: (resourceId: string) => `resource:${resourceId}`,
		} as GameEngine;

		expect(
			Effect.runSync(
				readTileActorsFx({
					game,
					runtime: nextRuntime,
					surface: "main",
				}),
			)[0]?.sourceUrl,
		).toBe("resource:asset:stage-2");
	});

	it("projects both default layers and drops the overlay for a progress source", () => {
		const game = {
			getResourceUrl: (resourceId: string) => `resource:${resourceId}`,
		} as GameEngine;
		const empty = Effect.runSync(
			readTileActorsFx({
				game,
				runtime: runtime({
					ownerItem: blueprintItem,
				}),
				surface: "main",
			}),
		)[0];
		const filled = Effect.runSync(
			readTileActorsFx({
				game,
				runtime: runtime({
					ownerItem: blueprintItem,
					storedQuantities: [
						3,
						3,
					],
				}),
				surface: "main",
			}),
		)[0];

		expect(empty).toMatchObject({
			sourceUrl: "resource:asset:blueprint-empty",
			compositeUrl: "resource:asset:blueprint-complete",
		});
		expect(filled).toMatchObject({
			sourceUrl: "resource:asset:blueprint-complete",
		});
		expect(filled).not.toHaveProperty("compositeUrl");
	});

	it("projects active job progress through the canonical tile actor read", () => {
		const nextRuntime = runtime({
			active: true,
		});
		const game = {
			getResourceUrl: (resourceId: string) => `resource:${resourceId}`,
		} as GameEngine;

		expect(
			Effect.runSync(
				readTileActorsFx({
					game,
					runtime: nextRuntime,
					surface: "main",
				}),
			)[0]?.progressRatio,
		).toBe(0.5);
	});
});
