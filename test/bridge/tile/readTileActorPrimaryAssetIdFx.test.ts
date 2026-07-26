import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { readTileActorPrimaryAssetIdFx } from "~/bridge/tile/readTileActorPrimaryAssetIdFx";
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
	categories: {},
	items: {
		material: {
			id: "material",
			type: "simple",
			title: "Material",
			description: "Material",
			asset: {
				source: [
					"asset:material-primary",
					"asset:material-unused-stage",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 10,
		},
		craft: {
			id: "craft",
			type: "craft",
			title: "Craft",
			description: "Craft",
			asset: {
				source: [
					"asset:stage-0",
					"asset:stage-1",
					"asset:stage-2",
					"asset:stage-3",
				],
			},
			tags: [],
			categoryId: "resource",
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
							type: "value",
							value: 6,
						},
						capacity: 3,
					},
				],
				rules: [],
			},
		},
		blueprint: {
			id: "blueprint",
			type: "blueprint",
			title: "Blueprint",
			description: "Blueprint",
			asset: {
				source: [
					"asset:blueprint-empty",
					"asset:blueprint-complete",
				],
			},
			tags: [],
			categoryId: "resource",
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
							type: "value",
							value: 3,
						},
					},
					{
						type: "materials",
						selector: {
							type: "item",
							itemId: "material",
						},
						quantity: {
							type: "value",
							value: 3,
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
	});
};

const readAssetId = (nextRuntime: RuntimeSchema.Type) => {
	const owner = nextRuntime.items.find((item) => item.id === "runtime:owner");
	if (owner === undefined) throw new Error("Missing progress owner.");
	return Effect.runSync(
		readTileActorPrimaryAssetIdFx({
			item: owner,
			runtime: nextRuntime,
		}),
	);
};

describe("readTileActorPrimaryAssetIdFx", () => {
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
		).toBe(assetId);
	});

	it("ignores buffered capacity above the required line quantity", () => {
		expect(
			readAssetId(
				runtime({
					storedQuantity: 9,
				}),
			),
		).toBe("asset:stage-3");
	});

	it("keeps the final stage while a job owns the consumed inputs", () => {
		expect(
			readAssetId(
				runtime({
					active: true,
				}),
			),
		).toBe("asset:stage-3");
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
		).toBe("asset:blueprint-complete");
	});

	it("keeps non-progressive item kinds on their first authored source", () => {
		const nextRuntime = runtime({});
		const material = {
			...nextRuntime.items[0],
			item: config.items.material,
		};

		expect(
			Effect.runSync(
				readTileActorPrimaryAssetIdFx({
					item: material,
					runtime: nextRuntime,
				}),
			),
		).toBe("asset:material-primary");
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
});
