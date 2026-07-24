import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readControlCursorSemanticFx } from "~/ui/cursor/readControlCursorSemanticFx";
import { readTileActorCursorSemanticFx } from "~/ui/tile/readTileActorCursorSemanticFx";

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

	it("exhaustively prioritizes live tile drag, rejection, work, and teardown states", () => {
		const base = {
			feedback: null,
			forbiddenDrop: false,
			live: true,
			phase: "stable" as const,
			running: false,
			visible: true,
		};
		expect(Effect.runSync(readTileActorCursorSemanticFx(base))).toBe("grab");
		expect(
			Effect.runSync(
				readTileActorCursorSemanticFx({
					...base,
					phase: "dragging",
				}),
			),
		).toBe("grabbing");
		expect(
			Effect.runSync(
				readTileActorCursorSemanticFx({
					...base,
					forbiddenDrop: true,
					phase: "dragging",
				}),
			),
		).toBe("not-allowed");
		expect(
			Effect.runSync(
				readTileActorCursorSemanticFx({
					...base,
					running: true,
				}),
			),
		).toBe("progress");
		expect(
			Effect.runSync(
				readTileActorCursorSemanticFx({
					...base,
					feedback: "rejected",
					phase: "targeted",
				}),
			),
		).toBe("not-allowed");
		expect(
			Effect.runSync(
				readTileActorCursorSemanticFx({
					...base,
					phase: "targeted",
				}),
			),
		).toBe("default");
		expect(
			Effect.runSync(
				readTileActorCursorSemanticFx({
					...base,
					live: false,
				}),
			),
		).toBe("default");
		expect(
			Effect.runSync(
				readTileActorCursorSemanticFx({
					...base,
					visible: false,
				}),
			),
		).toBe("default");
	});
});
