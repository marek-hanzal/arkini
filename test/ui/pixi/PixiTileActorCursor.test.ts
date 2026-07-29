import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readPixiTileActorCursorFx } from "~/ui/pixi/actor/readPixiTileActorCursorFx";

describe("Pixi tile actor cursor", () => {
	it("reserves progress exclusively for an actor with a running line", () => {
		expect(
			Effect.runSync(
				readPixiTileActorCursorFx({
					phase: "idle",
					running: false,
				}),
			),
		).toBe("grab");
		expect(
			Effect.runSync(
				readPixiTileActorCursorFx({
					dragPolicy: "main-target-presence",
					hasDropTarget: true,
					phase: "dragging",
					previewKind: "move",
					running: false,
				}),
			),
		).toBe("grabbing");
		expect(
			Effect.runSync(
				readPixiTileActorCursorFx({
					dragPolicy: "main-target-presence",
					hasDropTarget: true,
					phase: "dragging",
					previewKind: "ignored",
					running: false,
				}),
			),
		).toBe("grabbing");
		expect(
			Effect.runSync(
				readPixiTileActorCursorFx({
					dragPolicy: "main-target-presence",
					hasDropTarget: true,
					phase: "dragging",
					previewKind: "reject",
					running: false,
				}),
			),
		).toBe("grabbing");
		expect(
			Effect.runSync(
				readPixiTileActorCursorFx({
					dragPolicy: "main-target-presence",
					hasDropTarget: false,
					phase: "dragging",
					previewKind: "move",
					running: false,
				}),
			),
		).toBe("not-allowed");
		expect(
			Effect.runSync(
				readPixiTileActorCursorFx({
					dragPolicy: "preview-result",
					phase: "dragging",
					previewKind: "ignored",
					running: false,
				}),
			),
		).toBe("grab");
		expect(
			Effect.runSync(
				readPixiTileActorCursorFx({
					dragPolicy: "preview-result",
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
					running: false,
				}),
			),
		).toBe("grab");
		expect(
			Effect.runSync(
				readPixiTileActorCursorFx({
					phase: "pending",
					running: false,
				}),
			),
		).toBe("grab");
		expect(
			Effect.runSync(
				readPixiTileActorCursorFx({
					phase: "pending",
					running: true,
				}),
			),
		).toBe("progress");
		expect(
			Effect.runSync(
				readPixiTileActorCursorFx({
					phase: "idle",
					running: true,
				}),
			),
		).toBe("progress");
	});
});
