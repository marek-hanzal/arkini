import { describe, expect, it } from "vitest";
import { isLiveDragSessionForPointer } from "~/tile-engine/isLiveDragSessionForPointer";
import type { TileEngineActor } from "~/tile-engine/TileEngineActor.types";

const createSession = (
	overrides: Partial<TileEngineActor.DragSession> = {},
): TileEngineActor.DragSession => ({
	pointerId: 1,
	startX: 0,
	startY: 0,
	currentX: 0,
	currentY: 0,
	origin: {
		left: 0,
		top: 0,
		width: 10,
		height: 10,
	},
	source: {},
	started: true,
	longFired: false,
	released: false,
	...overrides,
});

describe("isLiveDragSessionForPointer", () => {
	it("keeps the current pointer live before release", () => {
		expect(
			isLiveDragSessionForPointer({
				pointerId: 1,
				session: createSession(),
			}),
		).toBe(true);
	});

	it("rejects pointer moves after pointer-up release", () => {
		expect(
			isLiveDragSessionForPointer({
				pointerId: 1,
				session: createSession({
					released: true,
				}),
			}),
		).toBe(false);
	});

	it("rejects stale pointer ids", () => {
		expect(
			isLiveDragSessionForPointer({
				pointerId: 2,
				session: createSession(),
			}),
		).toBe(false);
	});
});
