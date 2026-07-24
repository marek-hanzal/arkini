import { describe, expect, it } from "vitest";

import { readControlCursorSemantic } from "~/ui/cursor/readControlCursorSemantic";
import { readTileActorCursorSemantic } from "~/ui/tile/readTileActorCursorSemantic";

describe("semantic cursor resolvers", () => {
	it("keeps shared control pending and disabled meanings explicit", () => {
		expect(readControlCursorSemantic({})).toBe("pointer");
		expect(
			readControlCursorSemantic({
				disabled: true,
			}),
		).toBe("not-allowed");
		expect(
			readControlCursorSemantic({
				disabled: true,
				intent: "progress",
			}),
		).toBe("progress");
		expect(
			readControlCursorSemantic({
				ariaDisabled: true,
				intent: "wait",
			}),
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
		expect(readTileActorCursorSemantic(base)).toBe("grab");
		expect(
			readTileActorCursorSemantic({
				...base,
				phase: "dragging",
			}),
		).toBe("grabbing");
		expect(
			readTileActorCursorSemantic({
				...base,
				forbiddenDrop: true,
				phase: "dragging",
			}),
		).toBe("not-allowed");
		expect(
			readTileActorCursorSemantic({
				...base,
				running: true,
			}),
		).toBe("progress");
		expect(
			readTileActorCursorSemantic({
				...base,
				feedback: "rejected",
				phase: "targeted",
			}),
		).toBe("not-allowed");
		expect(
			readTileActorCursorSemantic({
				...base,
				phase: "targeted",
			}),
		).toBe("default");
		expect(
			readTileActorCursorSemantic({
				...base,
				live: false,
			}),
		).toBe("default");
		expect(
			readTileActorCursorSemantic({
				...base,
				visible: false,
			}),
		).toBe("default");
	});
});
