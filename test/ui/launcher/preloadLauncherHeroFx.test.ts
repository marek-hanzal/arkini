// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { preloadLauncherHeroFx } from "~/ui/launcher/preloadLauncherHeroFx";

describe("preloadLauncherHeroFx", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("decodes one Hero image and retains it for the complete renderer session", async () => {
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

		expect(images).toHaveLength(1);
		expect(images[0]).toMatchObject({
			decoding: "sync",
			fetchPriority: "high",
			loading: "eager",
			src: "hero.png",
		});
		expect(decode).toHaveBeenCalledOnce();
	});
});
