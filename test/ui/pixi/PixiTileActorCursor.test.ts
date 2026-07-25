import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readPixiTileActorCursorFx } from "~/ui/pixi/actor/readPixiTileActorCursorFx";

describe("Pixi tile actor cursor", () => {
	it("prioritizes native drag, rejection, pending and running feedback", () => {
		expect(
			Effect.runSync(
				readPixiTileActorCursorFx({
					phase: "idle",
					previewKind: null,
					running: false,
				}),
			),
		).toBe("grab");
		expect(
			Effect.runSync(
				readPixiTileActorCursorFx({
					phase: "dragging",
					previewKind: "move",
					running: false,
				}),
			),
		).toBe("grabbing");
		expect(
			Effect.runSync(
				readPixiTileActorCursorFx({
					phase: "dragging",
					previewKind: "reject",
					running: false,
				}),
			),
		).toBe("not-allowed");
		expect(
			Effect.runSync(
				readPixiTileActorCursorFx({
					phase: "pending",
					previewKind: null,
					running: false,
				}),
			),
		).toBe("progress");
		expect(
			Effect.runSync(
				readPixiTileActorCursorFx({
					phase: "idle",
					previewKind: null,
					running: true,
				}),
			),
		).toBe("progress");
	});
});
