import { describe, expect, it } from "vitest";

import {
	createProgressAssetRuntime,
	progressAssetTestConfig,
	readProgressAssetOwner,
} from "~test/tile-presentation/support/progressAssetTestFixture";
import { readTileActorAssetSourceIdsFn } from "~/tile-presentation/fn/readTileActorAssetSourceIdsFn";

const readAssetIds = (runtime: ReturnType<typeof createProgressAssetRuntime>) =>
	readTileActorAssetSourceIdsFn({
		item: readProgressAssetOwner(runtime),
		runtime,
	});

describe("readTileActorAssetSourceIdsFn", () => {
	it.each([
		{
			assetId: "asset:stage-0",
			label: "default",
			storedQuantity: 0,
		},
		{
			assetId: "asset:stage-2",
			label: "intermediate",
			storedQuantity: 4,
		},
		{
			assetId: "asset:stage-3",
			label: "complete",
			storedQuantity: 6,
		},
	])("selects the $label authored progress source", ({ assetId, storedQuantity }) => {
		expect(
			readAssetIds(
				createProgressAssetRuntime({
					storedQuantity,
				}),
			),
		).toEqual([
			assetId,
		]);
	});

	it("keeps non-progressive item kinds on their complete authored default", () => {
		const runtime = createProgressAssetRuntime();
		const material = {
			...readProgressAssetOwner(runtime),
			item: progressAssetTestConfig.items.material,
		};

		expect(
			readTileActorAssetSourceIdsFn({
				item: material,
				runtime,
			}),
		).toEqual([
			"asset:material-primary",
			"asset:material-unused-stage",
		]);
	});
});
