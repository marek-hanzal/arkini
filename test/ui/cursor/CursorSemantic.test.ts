import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readControlCursorSemanticFx } from "~/ui/cursor/readControlCursorSemanticFx";

describe("semantic cursor resolvers", () => {
	it("keeps shared control pending and disabled meanings explicit", () => {
		expect(Effect.runSync(readControlCursorSemanticFx({}))).toBe("pointer");
		expect(
			Effect.runSync(
				readControlCursorSemanticFx({
					disabled: true,
				}),
			),
		).toBe("not-allowed");
		expect(
			Effect.runSync(
				readControlCursorSemanticFx({
					disabled: true,
					intent: "progress",
				}),
			),
		).toBe("progress");
		expect(
			Effect.runSync(
				readControlCursorSemanticFx({
					ariaDisabled: true,
					intent: "wait",
				}),
			),
		).toBe("wait");
	});
});
