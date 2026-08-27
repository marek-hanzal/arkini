// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	cleanupPixiInventorySurfaceFixture,
	renderPixiInventorySurface,
	replacePixiInventorySurfaceRuntime,
	resetPixiInventorySurfaceFixture,
	spaceTransition,
	surfaceState,
} from "~test/ui/pixi/PixiInventorySurface.test/fixture";
import { spaceItem } from "~test/ui/pixi/PixiInventorySurface.test/items";

beforeEach(resetPixiInventorySurfaceFixture);
afterEach(cleanupPixiInventorySurfaceFixture);

describe("PixiInventorySurface Space activation", () => {
	it("returns to the Board only after Inventory Space activation commits", async () => {
		const { scene } = await renderPixiInventorySurface();

		surfaceState.spaceActivationSucceeds = false;
		await scene.onActivate(spaceItem, false, document.createElement("canvas"));

		expect(surfaceState.activateSpace).toHaveBeenCalledWith({
			currentSpace: 0,
			itemId: spaceItem.id,
			location: spaceItem.location,
			revision: spaceItem.revision,
		});
		expect(surfaceState.spaceActivated).not.toHaveBeenCalled();
		expect(surfaceState.projectSpaceActivation).not.toHaveBeenCalled();
		expect(surfaceState.release).not.toHaveBeenCalled();

		surfaceState.spaceActivationSucceeds = true;
		let releaseProjection: () => void = () => undefined;
		let acknowledgeProjectionStart: () => void = () => undefined;
		surfaceState.projection = new Promise<void>((resolve) => {
			releaseProjection = resolve;
		});
		const projectionStarted = new Promise<void>((resolve) => {
			acknowledgeProjectionStart = resolve;
		});
		surfaceState.projectSpaceActivation.mockImplementationOnce(acknowledgeProjectionStart);
		const activation = scene.onActivate(spaceItem, false, document.createElement("canvas"));
		await projectionStarted;

		expect(surfaceState.projectSpaceActivation).toHaveBeenCalledWith(spaceTransition);
		expect(surfaceState.spaceActivated).not.toHaveBeenCalled();

		releaseProjection();
		await activation;
		expect(surfaceState.spaceActivated).toHaveBeenCalledOnce();
		expect(surfaceState.release).not.toHaveBeenCalled();
	});

	it("returns to the Board for an accepted no-op without replaying an older transition", async () => {
		const { scene } = await renderPixiInventorySurface();
		surfaceState.spaceActivationTransition = null;

		await scene.onActivate(spaceItem, false, document.createElement("canvas"));

		expect(surfaceState.projectSpaceActivation).not.toHaveBeenCalled();
		expect(surfaceState.spaceActivated).toHaveBeenCalledOnce();
	});

	it("does not project a deferred activation into a replacement Inventory runtime", async () => {
		const { root, scene } = await renderPixiInventorySurface();
		let releaseActivation: () => void = () => undefined;
		surfaceState.activationGate = new Promise<void>((resolve) => {
			releaseActivation = resolve;
		});

		const activation = scene.onActivate(spaceItem, false, document.createElement("canvas"));
		await vi.waitFor(() => expect(surfaceState.activateSpace).toHaveBeenCalledOnce());

		await replacePixiInventorySurfaceRuntime(root);
		releaseActivation();
		await activation;

		expect(surfaceState.projectSpaceActivation).not.toHaveBeenCalled();
		expect(surfaceState.spaceActivated).not.toHaveBeenCalled();
	});
});
