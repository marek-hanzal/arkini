import { describe, expect, it } from "vitest";

import { resolveTranslationLocaleFn } from "~/translation/fn/resolveTranslationLocaleFn";

describe("resolveTranslationLocaleFn", () => {
	it("selects the first preferred language with an available regional catalog", () => {
		expect(
			resolveTranslationLocaleFn({
				availableLocales: [
					"en-US",
					"cs",
				],
				fallbackLocale: "en-US",
				preferredLocales: [
					"sk-SK",
					"cs-CZ",
					"en-GB",
				],
			}),
		).toBe("cs");
	});

	it("falls back when OS preferences are malformed or unavailable", () => {
		expect(
			resolveTranslationLocaleFn({
				availableLocales: [
					"en",
					"de",
				],
				fallbackLocale: "en",
				preferredLocales: [
					"not_a_locale",
					"ja-JP",
				],
			}),
		).toBe("en");
	});

	it("refuses to resolve without the configured fallback catalog", () => {
		expect(
			resolveTranslationLocaleFn({
				availableLocales: [
					"cs",
				],
				fallbackLocale: "en",
				preferredLocales: [
					"cs-CZ",
				],
			}),
		).toBeUndefined();
	});
});
