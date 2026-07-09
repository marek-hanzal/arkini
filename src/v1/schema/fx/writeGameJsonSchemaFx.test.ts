import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { generateGameJsonSchemaFx } from "./writeGameJsonSchemaFx";

describe("generateGameJsonSchemaFx", () => {
	it("generates a JSON Schema for the root game configuration contract", () => {
		const schema = Effect.runSync(generateGameJsonSchemaFx);

		expect(schema).toMatchObject({
			type: "object",
			properties: {
				items: {
					$ref: expect.stringMatching(/^#\/\$defs\//),
				},
				meta: {
					$ref: expect.stringMatching(/^#\/\$defs\//),
				},
				version: {
					$ref: expect.stringMatching(/^#\/\$defs\//),
				},
			},
		});
		expect(JSON.stringify(schema).length).toBeLessThan(1_000_000);
	});
});
