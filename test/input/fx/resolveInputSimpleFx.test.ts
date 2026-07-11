import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { resolveInputSimpleFx } from "~/v1/input/fx/resolveInputSimpleFx";

describe("resolveInputSimpleFx", () => {
	it("resolves one resource-free input as ready", () => {
		expect(
			Effect.runSync(
				resolveInputSimpleFx({
					input: {
						type: "simple",
					},
				}),
			),
		).toEqual({
			type: "simple",
			ready: true,
		});
	});
});
