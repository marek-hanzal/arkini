// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	cleanupPixiInventorySurfaceFixture,
	renderPixiInventorySurface,
	resetPixiInventorySurfaceFixture,
	surfaceState,
	unmountPixiInventorySurface,
} from "~test/game-scene/ui/PixiInventorySurface.test/fixture";
import { item } from "~test/game-scene/ui/PixiInventorySurface.test/items";

beforeEach(resetPixiInventorySurfaceFixture);
afterEach(cleanupPixiInventorySurfaceFixture);

describe("PixiInventorySurface", () => {
	it("releases an Inventory action item on click instead of activating its action", async () => {
		const { root, scene } = await renderPixiInventorySurface();
		const canvas = document.createElement("canvas");

		await scene.onActivateFn(
			{
				...item,
				primaryAction: {
					kind: "open-inventory",
					currentSpace: 0,
				},
			},
			false,
			canvas,
		);

		expect(surfaceState.release).toHaveBeenCalledWith({
			itemId: item.id,
			location: item.location,
			revision: item.revision,
		});
		expect(surfaceState.detail).not.toHaveBeenCalled();
		expect(surfaceState.interactionRegister).toHaveBeenCalledOnce();
		const registeredCancel = surfaceState.interactionRegister.mock.calls[0]?.[0] as
			| (() => void)
			| undefined;
		if (registeredCancel === undefined) throw new Error("Interaction cancel is missing.");
		registeredCancel();
		expect(surfaceState.interactionCancel).toHaveBeenCalledOnce();

		await unmountPixiInventorySurface(root);
		expect(surfaceState.interactionUnregister).toHaveBeenCalledOnce();
	});

	it("keeps right click as Item Detail without releasing the item", async () => {
		const { scene } = await renderPixiInventorySurface();
		const canvas = document.createElement("canvas");

		await scene.onActivateFn(item, true, canvas);

		expect(surfaceState.detail).toHaveBeenCalledWith({
			itemId: item.id,
			origin: canvas,
		});
		expect(surfaceState.release).not.toHaveBeenCalled();
	});
});
