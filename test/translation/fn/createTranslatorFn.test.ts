import { describe, expect, it } from "vitest";

import { createTranslatorFn } from "~/translation/fn/createTranslatorFn";

describe("createTranslatorFn", () => {
	it("resolves exact plain keys and preserves explicit empty translations", () => {
		const translator = createTranslatorFn({
			translations: [
				{
					key: "Producer",
					value: "Výrobce",
				},
				{
					key: "Intentionally empty",
					value: "",
				},
			],
		});

		expect(translator.valueFn("Producer")).toEqual({
			text: "Výrobce",
			type: "translation",
		});
		expect(translator.textFn("Intentionally empty", "fallback")).toBe("");
		expect(translator.valueFn("Missing", "Readable fallback")).toEqual({
			text: "Readable fallback",
			type: "fallback",
		});
		expect(translator.valueFn("Plain missing key")).toEqual({
			text: "Plain missing key",
			type: "key",
		});
	});
});
