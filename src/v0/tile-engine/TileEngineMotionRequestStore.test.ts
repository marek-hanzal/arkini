import { afterEach, describe, expect, it, vi } from "vitest";
import {
	clearTileEngineMotionRequests,
	readTileEngineMotionRequests,
	registerTileEngineMotionRequests,
} from "~/v0/tile-engine/TileEngineMotionRequestStore";

afterEach(() => {
	clearTileEngineMotionRequests();
	vi.useRealTimers();
});

describe("TileEngineMotionRequestStore", () => {
	it("settles only the exact registered request, not a newer request in the same group", () => {
		vi.useFakeTimers();
		const first = {
			groupId: "spawn:producer",
			kind: "fade-in" as const,
		};
		const second = {
			groupId: "spawn:producer",
			kind: "pop-in" as const,
		};

		registerTileEngineMotionRequests({
			engineId: "board",
			requests: [
				{
					cleanupDelayMs: 10,
					enter: first,
					tileId: "tile:one",
				},
			],
		});
		registerTileEngineMotionRequests({
			engineId: "board",
			requests: [
				{
					cleanupDelayMs: 20,
					enter: second,
					tileId: "tile:one",
				},
			],
		});

		vi.advanceTimersByTime(10);
		expect(readTileEngineMotionRequests("board").get("tile:one")?.enter).toBe(second);

		vi.advanceTimersByTime(10);
		expect(readTileEngineMotionRequests("board").get("tile:one")?.enter).toBeUndefined();
	});

	it("settles feedback requests independently from enter requests", () => {
		vi.useFakeTimers();
		const enter = {
			groupId: "spawn:producer",
			kind: "fade-in" as const,
		};
		const feedback = {
			groupId: "feedback:producer",
			kind: "bounce" as const,
		};

		registerTileEngineMotionRequests({
			engineId: "board",
			requests: [
				{
					cleanupDelayMs: 10,
					enter,
					tileId: "producer",
				},
				{
					cleanupDelayMs: 20,
					feedback,
					tileId: "producer",
				},
			],
		});

		vi.advanceTimersByTime(10);
		expect(readTileEngineMotionRequests("board").get("producer")?.enter).toBeUndefined();
		expect(readTileEngineMotionRequests("board").get("producer")?.feedback).toBe(feedback);

		vi.advanceTimersByTime(10);
		expect(readTileEngineMotionRequests("board").get("producer")).toBeUndefined();
	});
});
