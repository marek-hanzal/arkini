// @vitest-environment jsdom

import { Effect, Fiber } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { preloadLauncherHeroFx } from "~/launcher/fx/preloadLauncherHeroFx";

describe("preloadLauncherHeroFx", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("uses a fresh browser image for each scoped preload attempt", async () => {
		const decode = vi.fn(async () => undefined);
		const images: Array<ReadyImage> = [];
		class ReadyImage {
			complete = true;
			naturalWidth = 512;
			decoding = "auto";
			fetchPriority = "auto";
			loading = "auto";
			src = "";
			readonly decode = decode;
			constructor() {
				images.push(this);
			}
			addEventListener() {}
			removeEventListener() {}
		}
		vi.stubGlobal("Image", ReadyImage);

		await Effect.runPromise(
			preloadLauncherHeroFx({
				url: "hero.png",
			}),
		);
		await Effect.runPromise(
			preloadLauncherHeroFx({
				url: "hero.png",
			}),
		);

		expect(images).toHaveLength(2);
		expect(images).toEqual([
			expect.objectContaining({
				decoding: "sync",
				fetchPriority: "high",
				loading: "eager",
				src: "hero.png",
			}),
			expect.objectContaining({
				decoding: "sync",
				fetchPriority: "high",
				loading: "eager",
				src: "hero.png",
			}),
		]);
		expect(decode).toHaveBeenCalledTimes(2);
	});

	it("removes pending DOM listeners when the preload fiber is interrupted", async () => {
		const added = new Map<string, EventListener>();
		const removed: string[] = [];
		class PendingImage {
			complete = false;
			naturalWidth = 0;
			decoding = "auto";
			fetchPriority = "auto";
			loading = "auto";
			src = "";
			decode = vi.fn(async () => undefined);
			addEventListener(type: string, listener: EventListener) {
				added.set(type, listener);
			}
			removeEventListener(type: string) {
				removed.push(type);
				added.delete(type);
			}
		}
		vi.stubGlobal("Image", PendingImage);

		const fiber = Effect.runFork(
			preloadLauncherHeroFx({
				url: "pending.png",
			}),
		);
		await vi.waitFor(() =>
			expect([
				...added.keys(),
			]).toEqual([
				"load",
				"error",
			]),
		);
		await Effect.runPromise(Fiber.interrupt(fiber));

		expect(removed).toEqual([
			"load",
			"error",
		]);
		expect(added.size).toBe(0);
	});
});
