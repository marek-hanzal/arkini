import { describe, expect, it } from "vitest";

import { createTranslatorFn } from "~/translation/fn/createTranslatorFn";

describe("createTranslatorFn", () => {
	it("resolves exact plain keys and preserves explicit empty translations", () => {
		const translator = createTranslatorFn({
			translations: {
				Producer: {
					value: "Výrobce",
				},
				"Intentionally empty": {
					value: "",
				},
			},
		});

		expect(translator.textFn("Producer")).toBe("Výrobce");
		expect(translator.textFn("Intentionally empty", "fallback")).toBe("");
		expect(translator.textFn("Missing", "Readable fallback")).toBe("Readable fallback");
		expect(translator.textFn("Plain missing key")).toBe("Plain missing key");
	});
});
