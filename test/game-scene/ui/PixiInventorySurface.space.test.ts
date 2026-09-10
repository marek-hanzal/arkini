// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	cleanupPixiInventorySurfaceFixture,
	renderPixiInventorySurface,
	resetPixiInventorySurfaceFixture,
	surfaceState,
} from "~test/game-scene/ui/PixiInventorySurface.test/fixture";
import { spaceItem } from "~test/game-scene/ui/PixiInventorySurface.test/items";

beforeEach(resetPixiInventorySurfaceFixture);
afterEach(cleanupPixiInventorySurfaceFixture);

describe("PixiInventorySurface Space release", () => {
	it("releases an Inventory Space item without activating its destination", async () => {
		const { scene } = await renderPixiInventorySurface();
		const canvas = document.createElement("canvas");

		await scene.onActivateFn(spaceItem, false, canvas);

		expect(surfaceState.release).toHaveBeenCalledWith({
			itemId: spaceItem.id,
			location: spaceItem.location,
			revision: spaceItem.revision,
		});
	});
});
