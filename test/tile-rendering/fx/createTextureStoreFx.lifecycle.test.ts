// @vitest-environment jsdom

import { Effect } from "effect";
import { Assets, Texture, TextureSource } from "pixi.js";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTextureStoreFx, type TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";

const url = "serakki://app/editor/resource?projectId=p&resourceId=r&version=v";
const stores: TextureStore[] = [];
let originalParsers: typeof Assets.loader.parsers;
let loadTextureFn: () => Promise<Texture>;
let loadCount = 0;

const createTextureFn = () =>
	new Texture({
		source: new TextureSource({
			width: 4,
			height: 4,
		}),
	});
const createStoreFn = (idleBudgetBytes?: number) => {
	const store = Effect.runSync(createTextureStoreFx(idleBudgetBytes));
	stores.push(store);
	return store;
};

beforeAll(async () => {
	await Assets.init({
		skipDetections: true,
	});
});

beforeEach(() => {
	originalParsers = [
		...Assets.loader.parsers,
	];
	loadCount = 0;
	loadTextureFn = async () => createTextureFn();
	// Keep Pixi's real global cache and unload path; only replace image decoding.
	Assets.loader.parsers.splice(0, Assets.loader.parsers.length, {
		id: "texture",
		load: async () => {
			loadCount += 1;
			return loadTextureFn();
		},
		unload: async (texture: Texture) => texture.destroy(true),
	});
});

afterEach(async () => {
	for (const store of stores.splice(0)) await Effect.runPromise(store.closeFx);
	Assets.loader.parsers.splice(0, Assets.loader.parsers.length, ...originalParsers);
});

describe("TextureStore / overlapping route generations", () => {
	it("keeps another route's active texture alive when the previous store closes", async () => {
		const previous = createStoreFn();
		const current = createStoreFn();
		const previousLease = previous.acquireFn(url);
		const previousTexture = await Effect.runPromise(previousLease.textureFx);
		const currentLease = current.acquireFn(url);
		const currentTexture = await Effect.runPromise(currentLease.textureFx);

		await Effect.runPromise(previous.closeFx);

		expect(currentTexture).toBe(previousTexture);
		expect(currentTexture.destroyed).toBe(false);
		expect(loadCount).toBe(1);
		currentLease.releaseFn();
		await Effect.runPromise(current.closeFx);
		expect(currentTexture.destroyed).toBe(true);
	});

	it("pins another route's active texture across local idle eviction", async () => {
		const previous = createStoreFn(0);
		const current = createStoreFn();
		const previousLease = previous.acquireFn(url);
		await Effect.runPromise(previousLease.textureFx);
		const currentLease = current.acquireFn(url);
		const currentTexture = await Effect.runPromise(currentLease.textureFx);

		previousLease.releaseFn();
		await Effect.runPromise(previous.closeFx);

		expect(currentTexture.destroyed).toBe(false);
		currentLease.releaseFn();
	});

	it("waits for the old pending unload before a reopened route loads the same URL", async () => {
		let resolveLoadFn: (texture: Texture) => void = () => {};
		const pendingTexture = new Promise<Texture>((resolve) => {
			resolveLoadFn = resolve;
		});
		loadTextureFn = () => pendingTexture;
		const previous = createStoreFn();
		const oldLease = previous.acquireFn(url);
		const oldLoad = Effect.runPromise(oldLease.textureFx);
		const closing = Effect.runPromise(previous.closeFx);
		const current = createStoreFn();
		const currentLease = current.acquireFn(url);
		const currentLoad = Effect.runPromise(currentLease.textureFx);
		// Let both routes attempt admission while the first decoder remains pending.
		await new Promise<void>((resolve) => setTimeout(resolve, 0));
		const oldTexture = createTextureFn();
		loadTextureFn = async () => createTextureFn();
		resolveLoadFn(oldTexture);
		await oldLoad;
		await closing;
		const currentTexture = await currentLoad;

		expect(currentTexture.destroyed).toBe(false);
		expect(oldTexture.destroyed).toBe(true);
		expect(currentTexture).not.toBe(oldTexture);
		expect(loadCount).toBe(2);
		currentLease.releaseFn();
	});
});
