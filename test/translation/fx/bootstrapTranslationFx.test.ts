import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { TranslationPreferencesReadError } from "~/translation/error/TranslationPreferencesReadError";
import { bootstrapTranslationFx } from "~/translation/fx/bootstrapTranslationFx";
import { translator } from "~/translation/service/translator";

describe("bootstrapTranslationFx", () => {
	it("reads platform preferences and publishes the negotiated process translator", async () => {
		const readPreferredLanguagesFn = vi.fn(() =>
			Promise.resolve([
				"cs-CZ",
				"en-GB",
			]),
		);

		const result = await Effect.runPromise(
			bootstrapTranslationFx({
				readPreferredLanguagesFn,
			}),
		);

		expect(readPreferredLanguagesFn).toHaveBeenCalledOnce();
		expect(result.translator).toBe(translator);
		expect(translator.textFn("Synthetic missing key", "Synthetic fallback")).toBe(
			"Synthetic fallback",
		);
	});

	it("types a rejected platform preference read", async () => {
		const cause = new Error("Localization IPC is unavailable.");
		const failure = await Effect.runPromise(
			bootstrapTranslationFx({
				readPreferredLanguagesFn: () => Promise.reject(cause),
			}).pipe(Effect.flip),
		);

		expect(failure).toBeInstanceOf(TranslationPreferencesReadError);
		expect(failure).toMatchObject({
			_tag: "TranslationPreferencesReadError",
			cause,
		});
	});
});
