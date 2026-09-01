import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { loadTranslatorFx } from "~/translation/fx/loadTranslatorFx";

describe("loadTranslatorFx", () => {
	it("loads the negotiated bundled catalog", async () => {
		const result = await Effect.runPromise(
			loadTranslatorFx({
				preferredLocales: [
					"cs-CZ",
					"en-GB",
				],
			}),
		);

		expect(result.locale).toBe("en");
		expect(result.translator.textFn("Missing translation key")).toBe("Missing translation key");
	});
});
