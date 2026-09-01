import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createTranslatorFn } from "~/translation/fn/createTranslatorFn";
import { setTranslatorFx, translator } from "~/translation/service/translator";

describe("translator", () => {
	it("shares the bootstrap-selected catalog with plain modules", () => {
		const selectedTranslator = createTranslatorFn({
			translations: {
				Producer: {
					value: "Producent",
				},
			},
		});
		const translatedKey = [
			"Producer",
		].join("");
		const missingKey = [
			"Missing",
		].join("");

		Effect.runSync(setTranslatorFx(selectedTranslator));

		expect(translator.textFn(translatedKey)).toBe("Producent");
		expect(translator.textFn(missingKey, "Fallback")).toBe("Fallback");
	});
});
