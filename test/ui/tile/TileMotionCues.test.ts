// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameEventBatchSchema } from "~/engine/event/schema/GameEventBatchSchema";
import type { useTileActors } from "~/bridge/tile/useTileActors";
import { TileMotionCueVisual } from "~/ui/tile/TileMotionCueVisual";
import { useTileMotionCues } from "~/ui/tile/useTileMotionCues";
import { motionTestRuntime } from "~test/ui/support/motionReactMock";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const eventState = vi.hoisted(() => ({
	listener: null as ((batch: GameEventBatchSchema.Type) => void) | null,
	game: {} as object,
}));

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));
vi.mock("~/bridge/event/useGameEvents", () => ({
	useGameEvents: (listener: (batch: GameEventBatchSchema.Type) => void) => {
		eventState.listener = listener;
	},
}));
vi.mock("~/bridge/game/useGameEngine", () => ({
	useGameEngine: () => eventState.game,
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

const item = (
	id: string,
	scope: "board" | "inventory" = "board",
	space = 0,
): useTileActors.Item => ({
	id,
	revision: `revision:${id}`,
	itemId: `item:${id}`,
	title: id,
	quantity: 1,
	sourceUrl: `asset://${id}`,
	location:
		scope === "board"
			? {
					scope,
					space,
					position: { x: 0, y: 0 },
				}
			: {
					scope,
					position: { x: 0, y: 0 },
				},
	running: false,
	primaryAction: { kind: "none" },
});

const dispatch = async (events: GameEventBatchSchema.Type["events"]) => {
	const listener = eventState.listener;
	if (listener === null) throw new Error("Missing game event listener.");
	await act(async () => {
		listener({ events });
		await Promise.resolve();
	});
};

describe("tile motion cue lifecycle", () => {
	beforeEach(() => {
		eventState.listener = null;
		eventState.game = {};
		motionTestRuntime.reset();
	});

	afterEach(async () => {
		await act(async () => {
			for (const root of roots.splice(0)) root.unmount();
		});
		vi.useRealTimers();
		document.body.replaceChildren();
	});

	it("maps an existing identity placement to the shared spawn cue", async () => {
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const liveItems = [item("runtime:placed")];
		const onSceneReset = vi.fn();
		const Capture = () => {
			current = useTileMotionCues({ liveItems, onSceneReset });
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));

		await dispatch([
			{
				type: GameEventEnumSchema.enum.ItemPlaced,
				itemId: "runtime:placed",
				canonicalItemId: "item:placed",
				previousLocation: {
					scope: "input",
					ownerItemId: "runtime:owner",
					lineId: "line:owner",
					inputIndex: 0,
				},
				location: liveItems[0].location,
				quantity: 1,
			},
		]);

		expect(current?.cues.get("runtime:placed")?.kind).toBe("spawn");
	});

	it("coalesces repeated impacts and ignores stale completion generations", async () => {
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const liveItems = [item("runtime:stack")];
		const onSceneReset = vi.fn();
		const Capture = () => {
			current = useTileMotionCues({ liveItems, onSceneReset });
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));

		await dispatch([
			{
				type: GameEventEnumSchema.enum.ItemStacked,
				itemId: "runtime:stack",
				canonicalItemId: "item:stack",
				location: liveItems[0].location,
				previousQuantity: 1,
				quantity: 2,
			},
		]);
		const first = current?.cues.get("runtime:stack");
		if (first === undefined) throw new Error("Missing first cue.");

		await dispatch([
			{
				type: GameEventEnumSchema.enum.ItemStacked,
				itemId: "runtime:stack",
				canonicalItemId: "item:stack",
				location: liveItems[0].location,
				previousQuantity: 2,
				quantity: 3,
			},
		]);
		const second = current?.cues.get("runtime:stack");
		expect(second).toMatchObject({ kind: "impact", strength: 2 });
		expect(second?.generation).not.toBe(first.generation);

		await act(async () => current?.complete("runtime:stack", first.generation));
		expect(current?.cues.get("runtime:stack")?.generation).toBe(second?.generation);
	});

	it("retains an outgoing actor only for its owned exit generation", async () => {
		let liveItems = [item("runtime:removed")];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const onSceneReset = vi.fn();
		const Capture = () => {
			current = useTileMotionCues({ liveItems, onSceneReset });
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));
		await dispatch([
			{
				type: GameEventEnumSchema.enum.ItemExpired,
				itemId: "runtime:removed",
				canonicalItemId: "item:removed",
				location: liveItems[0].location,
				quantity: 1,
			},
		]);
		liveItems = [];
		await act(async () => root.render(createElement(Capture)));

		const exit = current?.cues.get("runtime:removed");
		expect(exit?.kind).toBe("exit");
		expect(current?.retainedItems.map((retained) => retained.id)).toEqual([
			"runtime:removed",
		]);
		if (exit === undefined) throw new Error("Missing exit cue.");
		await act(async () => current?.complete("runtime:removed", exit.generation));
		expect(current?.retainedItems).toEqual([]);
	});

	it("coordinates independent outgoing expiry and incoming spawn when runtime publishes first", async () => {
		let liveItems = [item("runtime:outgoing")];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const onSceneReset = vi.fn();
		const Capture = () => {
			current = useTileMotionCues({ liveItems, onSceneReset });
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));

		liveItems = [item("runtime:incoming")];
		await act(async () => root.render(createElement(Capture)));
		await dispatch([
			{
				type: GameEventEnumSchema.enum.ItemExpired,
				itemId: "runtime:outgoing",
				canonicalItemId: "item:outgoing",
				quantity: 1,
				location: {
					scope: "board",
					space: 0,
					position: { x: 0, y: 0 },
				},
			},
			{
				type: GameEventEnumSchema.enum.ItemSpawned,
				itemId: "runtime:incoming",
				canonicalItemId: "item:incoming",
				quantity: 1,
				location: liveItems[0].location,
			},
		]);

		const exit = current?.cues.get("runtime:outgoing");
		expect(exit?.kind).toBe("exit");
		expect(current?.cues.get("runtime:incoming")?.kind).toBe("spawn");
		expect(current?.retainedItems.map((retained) => retained.id)).toEqual([
			"runtime:outgoing",
		]);
		if (exit === undefined) throw new Error("Missing outgoing exit cue.");

		await act(async () => current?.complete("runtime:outgoing", exit.generation));

		expect(current?.retainedItems).toEqual([]);
	});

	it("releases retained exits through the bounded fallback when Motion never completes", async () => {
		vi.useFakeTimers();
		let liveItems = [item("runtime:fallback")];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const onSceneReset = vi.fn();
		const Capture = () => {
			current = useTileMotionCues({ liveItems, onSceneReset });
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));
		await dispatch([
			{
				type: GameEventEnumSchema.enum.ItemExpired,
				itemId: "runtime:fallback",
				canonicalItemId: "item:fallback",
				location: liveItems[0].location,
				quantity: 1,
			},
		]);
		liveItems = [];
		await act(async () => root.render(createElement(Capture)));
		expect(current?.retainedItems).toHaveLength(1);

		await act(async () => vi.advanceTimersByTime(1_200));

		expect(current?.cues.size).toBe(0);
		expect(current?.retainedItems).toEqual([]);
	});

	it("clears cues, retained actors, and scene interaction when Game identity changes", async () => {
		const liveItems = [item("runtime:old-game")];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const onSceneReset = vi.fn();
		const Capture = () => {
			current = useTileMotionCues({ liveItems, onSceneReset });
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));
		await dispatch([
			{
				type: GameEventEnumSchema.enum.ItemExpired,
				itemId: "runtime:old-game",
				canonicalItemId: "item:old-game",
				location: liveItems[0].location,
				quantity: 1,
			},
		]);
		expect(current?.retainedItems).toHaveLength(1);

		eventState.game = {};
		await act(async () => root.render(createElement(Capture)));

		expect(onSceneReset).toHaveBeenCalledOnce();
		expect(current?.cues.size).toBe(0);
		expect(current?.retainedItems).toEqual([]);
	});

	it("resets the scene and settles only the newly visible board space", async () => {
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		let liveItems = [
			item("runtime:board:old"),
			item("runtime:inventory", "inventory"),
		];
		const onSceneReset = vi.fn();
		const Capture = () => {
			current = useTileMotionCues({ liveItems, onSceneReset });
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));
		await dispatch([
			{
				type: GameEventEnumSchema.enum.ItemSpawned,
				itemId: "runtime:board:old",
				canonicalItemId: "item:board:old",
				location: liveItems[0].location,
				quantity: 1,
			},
			{
				type: GameEventEnumSchema.enum.ItemSpawned,
				itemId: "runtime:inventory",
				canonicalItemId: "item:inventory",
				location: liveItems[1].location,
				quantity: 1,
			},
		]);
		liveItems = [
			item("runtime:board:old"),
			item("runtime:board:new", "board", 1),
			item("runtime:inventory", "inventory"),
		];
		await dispatch([
			{
				type: GameEventEnumSchema.enum.CurrentSpaceChanged,
				previousSpace: 0,
				currentSpace: 1,
			},
		]);

		expect(onSceneReset).toHaveBeenCalledOnce();
		expect(current?.cues.has("runtime:board:old")).toBe(false);
		expect(current?.cues.get("runtime:board:new")?.kind).toBe("settle");
		expect(current?.cues.get("runtime:inventory")?.kind).toBe("spawn");
	});
});

describe("TileMotionCueVisual", () => {
	beforeEach(() => motionTestRuntime.reset());

	afterEach(async () => {
		await act(async () => {
			for (const root of roots.splice(0)) root.unmount();
		});
		document.body.replaceChildren();
	});

	it("owns cue completion independently from the interaction shell", async () => {
		motionTestRuntime.autoComplete = false;
		const completed: number[] = [];
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(
					TileMotionCueVisual,
					{
						cue: { generation: 7, kind: "impact", strength: 2 },
						enabled: true,
						onComplete: (generation) => completed.push(generation),
					},
					createElement("span", null, "tile"),
				),
			);
		});
		expect(
			document.querySelector('[data-ui="TileMotionCueVisual"]')?.getAttribute(
				"data-motion-cue",
			),
		).toBe("impact");
		expect(completed).toEqual([]);
		await act(async () => motionTestRuntime.finish(0));
		expect(completed).toEqual([7]);
	});
});
