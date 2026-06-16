import { describe, expect, it } from "vitest";
import { clearTileEngineEnterMotion } from "~/v0/play/tile-engine-motion/clearTileEngineEnterMotion";
import type { TileEngineMotionSchema } from "~/v0/tile-engine/TileEngineMotionSchema";

describe("clearTileEngineEnterMotion", () => {
	it("clears only matching enter motion metadata", () => {
		const motion = {
			enter: {
				kind: "fade-in",
				groupId: "spawn:one",
			},
		} satisfies TileEngineMotionSchema.Type;

		expect(clearTileEngineEnterMotion(motion, "spawn:one")).toBeUndefined();
		expect(clearTileEngineEnterMotion(motion, "spawn:two")).toBe(motion);
	});

	it("keeps exit motion when only enter metadata settles", () => {
		const motion = {
			enter: {
				kind: "merge-in",
				groupId: "merge:one",
			},
			exit: {
				kind: "merge-out",
				groupId: "merge:one",
			},
		} satisfies TileEngineMotionSchema.Type;

		expect(clearTileEngineEnterMotion(motion, "merge:one")).toEqual({
			exit: motion.exit,
		});
	});
});
