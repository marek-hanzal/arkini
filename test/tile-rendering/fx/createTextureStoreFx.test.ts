// @vitest-environment jsdom

import { Effect } from "effect";
import { Assets, type Texture } from "pixi.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTextureStoreFx } from "~/tile-rendering/fx/createTextureStoreFx";

const createTexture = (pixelWidth: number, pixelHeight: number, resolution = 1) =>
	({
		source: {
			height: pixelHeight / resolution,
			pixelHeight,
			pixelWidth,
			width: pixelWidth / resolution,
		},
	}) as Texture;

const readUrlFn = (source: unknown) =>
	(
		source as {
			readonly src: string;
		}
	).src;

afterEach(() => {
	vi.restoreAllMocks();
});

describe("TextureStore", () => {
	it("shares one load while independent leases keep the texture pinned", async () => {
		const texture = createTexture(2, 2);
		const load = vi.spyOn(Assets, "load").mockResolvedValue(texture as never);
		const unload = vi.spyOn(Assets, "unload").mockResolvedValue(undefined);
		const store = Effect.runSync(createTextureStoreFx(16));
		const first = store.acquireFn("resource:a");
		const second = store.acquireFn("resource:a");

		await expect(Effect.runPromise(first.textureFx)).resolves.toBe(texture);
		await expect(Effect.runPromise(second.textureFx)).resolves.toBe(texture);
		expect(load).toHaveBeenCalledOnce();
		first.releaseFn();
		expect(unload).not.toHaveBeenCalled();
		second.releaseFn();
		expect(unload).not.toHaveBeenCalled();

		await Effect.runPromise(store.closeFx);
		expect(unload).toHaveBeenCalledWith("resource:a");
	});

	it("evicts least-recently-used idle textures by decoded byte estimate", async () => {
		const textures = new Map([
			[
				"resource:a",
				createTexture(2, 2),
			],
			[
				"resource:b",
				createTexture(2, 2),
			],
		]);
		vi.spyOn(Assets, "load").mockImplementation((async (source: unknown) => {
			const texture = textures.get(readUrlFn(source));
			if (texture === undefined) throw new Error("Missing test texture.");
			return texture;
		}) as never);
		const unload = vi.spyOn(Assets, "unload").mockResolvedValue(undefined);
		const store = Effect.runSync(createTextureStoreFx(16));

		const first = store.acquireFn("resource:a");
		await Effect.runPromise(first.textureFx);
		first.releaseFn();
		const second = store.acquireFn("resource:b");
		await Effect.runPromise(second.textureFx);
		second.releaseFn();

		await vi.waitFor(() => expect(unload).toHaveBeenCalledWith("resource:a"));
		expect(unload).not.toHaveBeenCalledWith("resource:b");
		await Effect.runPromise(store.closeFx);
	});

	it("unloads an oversized texture after its final lease", async () => {
		vi.spyOn(Assets, "load").mockResolvedValue(createTexture(4, 4, 2) as never);
		const unload = vi.spyOn(Assets, "unload").mockResolvedValue(undefined);
		const store = Effect.runSync(createTextureStoreFx(16));
		const lease = store.acquireFn("resource:large");

		await Effect.runPromise(lease.textureFx);
		lease.releaseFn();

		await vi.waitFor(() => expect(unload).toHaveBeenCalledWith("resource:large"));
		await Effect.runPromise(store.closeFx);
	});

	it("unloads a late completion and serializes reacquisition behind it", async () => {
		let resolveFirstFn: ((texture: Texture) => void) | undefined;
		const firstTexture = createTexture(2, 2);
		const secondTexture = createTexture(2, 2);
		const load = vi.spyOn(Assets, "load").mockImplementation(
			(() =>
				new Promise<Texture>((resolve) => {
					if (resolveFirstFn === undefined) {
						resolveFirstFn = resolve;
						return;
					}
					resolve(secondTexture);
				})) as never,
		);
		const unload = vi.spyOn(Assets, "unload").mockResolvedValue(undefined);
		const store = Effect.runSync(createTextureStoreFx(16));
		const abandoned = store.acquireFn("resource:a");
		abandoned.releaseFn();
		const replacement = store.acquireFn("resource:a");

		await vi.waitFor(() => expect(resolveFirstFn).toBeDefined());
		expect(load).toHaveBeenCalledOnce();
		resolveFirstFn?.(firstTexture);
		await vi.waitFor(() => expect(unload).toHaveBeenCalledWith("resource:a"));
		await expect(Effect.runPromise(replacement.textureFx)).resolves.toBe(secondTexture);
		expect(load).toHaveBeenCalledTimes(2);

		replacement.releaseFn();
		await Effect.runPromise(store.closeFx);
	});

	it("closes admission and clears pending loads after they settle", async () => {
		let resolveFn: ((texture: Texture) => void) | undefined;
		vi.spyOn(Assets, "load").mockImplementation(
			(() =>
				new Promise<Texture>((resolve) => {
					resolveFn = resolve;
				})) as never,
		);
		const unload = vi.spyOn(Assets, "unload").mockResolvedValue(undefined);
		const store = Effect.runSync(createTextureStoreFx(16));
		store.acquireFn("resource:pending");
		const close = Effect.runPromise(store.closeFx);

		expect(() => store.acquireFn("resource:late")).toThrow("Pixi texture store is closed.");
		await vi.waitFor(() => expect(resolveFn).toBeDefined());
		resolveFn?.(createTexture(2, 2));
		await close;
		expect(unload).toHaveBeenCalledWith("resource:pending");
	});
});
