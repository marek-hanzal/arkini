// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { preloadLauncherHeroFx } from "~/ui/launcher/preloadLauncherHeroFx";

describe("preloadLauncherHeroFx", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("does not complete until the Hero can be decoded for painting", async () => {
		const decode = vi.fn(async () => undefined);
		class ReadyImage {
			complete = true;
			naturalWidth = 512;
			decoding = "auto";
			onload: (() => void) | null = null;
			onerror: (() => void) | null = null;
			src = "";
			readonly decode = decode;
		}
		vi.stubGlobal("Image", ReadyImage);

		await Effect.runPromise(
			preloadLauncherHeroFx({
				url: "hero.png",
			}),
		);
		expect(decode).toHaveBeenCalledOnce();
	});
});
