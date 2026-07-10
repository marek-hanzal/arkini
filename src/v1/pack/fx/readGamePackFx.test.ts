import { gzipSync } from "fflate";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { encodeFx } from "./encodeFx";
import { readGamePackFx } from "./readGamePackFx";

describe("readGamePackFx", () => {
	it("gunzips, decodes, and validates a complete game pack", async () => {
		const compressed = await Effect.runPromise(
			Effect.gen(function* () {
				const bytes = yield* encodeFx({
					config: {
						version: "1.0",
						meta: {
							id: "test",
							title: "Test game",
							board: {
								width: 1,
								height: 1,
							},
							inventory: {
								width: 1,
								height: 1,
							},
						},
						categories: {},
						items: {},
					},
					resources: [],
				});

				return gzipSync(bytes);
			}),
		);
		const payload = await Effect.runPromise(readGamePackFx(compressed));

		expect(payload.config.meta.title).toBe("Test game");
		expect(payload.resources).toEqual([]);
	});
});
