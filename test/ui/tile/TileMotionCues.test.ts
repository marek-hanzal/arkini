// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { readTileActorTransitionFx } from "~/bridge/tile/readTileActorTransitionFx";
import type { TileActorTransitionSource } from "~/bridge/tile/useTileActorTransitionSource";
import type { useTileActors } from "~/bridge/tile/useTileActors";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { TileActorContent } from "~/ui/tile/TileActorContent";
import { TileMotionCueVisual } from "~/ui/tile/TileMotionCueVisual";
import { useTileMotionCues } from "~/ui/tile/useTileMotionCues";
import { motionTestRuntime } from "~test/ui/support/motionReactMock";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const eventState = vi.hoisted(() => ({
	listener: null as ((transition: readTileActorTransitionFx.Result) => void) | null,
	sequence: 0,
	liveItems: [] as ReadonlyArray<useTileActors.Item>,
	source: null as TileActorTransitionSource | null,
}));

const createTransitionSource = (
	initialEvents: readTileActorTransitionFx.Result["events"] = [],
): TileActorTransitionSource => ({
	get initial() {
		return {
			sequence: eventState.sequence,
			previousItems: null,
			liveItems: eventState.liveItems,
			events: initialEvents,
		};
	},
	subscribe: (listener) => {
		eventState.listener = listener;
		return () => {
			if (eventState.listener === listener) eventState.listener = null;
		};
	},
});

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));
vi.mock("~/bridge/tile/useTileActorTransitionSource", () => ({
	useTileActorTransitionSource: () => {
		if (eventState.source === null) throw new Error("Missing tile transition source.");
		return eventState.source;
	},
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

const item = (
	id: string,
	scope: "board" | "inventory" = "board",
	space = 0,
	quantity = 1,
): useTileActors.Item => ({
	id,
	revision: `revision:${id}`,
	itemId: `item:${id}`,
	title: id,
	quantity,
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

const dispatch = async (
	events: readTileActorTransitionFx.Result["events"],
	nextLiveItems = eventState.liveItems,
) => {
	const listener = eventState.listener;
	if (listener === null) throw new Error("Missing committed-transition listener.");
	const previousItems = eventState.liveItems;
	eventState.liveItems = nextLiveItems;
	await act(async () => {
		listener({
			sequence: ++eventState.sequence,
			previousItems,
			liveItems: nextLiveItems,
			events,
		});
		await Promise.resolve();
	});
};

describe("tile motion cue lifecycle", () => {
	beforeEach(() => {
		eventState.listener = null;
		eventState.sequence = 0;
		eventState.liveItems = [];
		eventState.source = createTransitionSource();
		motionTestRuntime.reset();
	});

	afterEach(async () => {
		await act(async () => {
			for (const root of roots.splice(0)) root.unmount();
		});
		vi.useRealTimers();
		document.body.replaceChildren();
	});

	it("projects the captured current transition with its spawn cue before the first paint", async () => {
		const liveItems = [item("runtime:initial-spawn")];
		eventState.liveItems = liveItems;
		eventState.source = createTransitionSource([
			{
				type: GameEventEnumSchema.enum.ItemSpawned,
				itemId: "runtime:initial-spawn",
				canonicalItemId: "item:initial-spawn",
				originItemId: "runtime:origin",
				location: liveItems[0].location,
				quantity: 1,
			},
		]);
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({ onSceneReset: vi.fn() });
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => root.render(createElement(Capture)));

		expect(current?.liveItems.map((candidate) => candidate.id)).toEqual([
			"runtime:initial-spawn",
		]);
		expect(current?.cues.get("runtime:initial-spawn")).toMatchObject({
			kind: "spawn",
			originItemId: "runtime:origin",
		});
	});

	it("does not rerender the actor layer for an empty transition with the same live projection", async () => {
		const liveItems = [item("runtime:stable")];
		eventState.liveItems = liveItems;
		eventState.source = createTransitionSource();
		let renders = 0;
		const Capture = () => {
			renders += 1;
			useTileMotionCues({ onSceneReset: vi.fn() });
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => root.render(createElement(Capture)));
		expect(renders).toBe(1);

		await dispatch([], liveItems);
		expect(renders).toBe(1);
	});

	it("maps an existing identity placement to the shared spawn cue", async () => {
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const liveItems = [item("runtime:placed")];
		const onSceneReset = vi.fn();
		const Capture = () => {
			eventState.liveItems = liveItems;
			current = useTileMotionCues({ onSceneReset });
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
				originItemId: "runtime:owner",
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

		expect(current?.cues.get("runtime:placed")).toMatchObject({
			kind: "spawn",
			originItemId: "runtime:owner",
		});
	});

	it("coalesces repeated impacts and ignores stale completion generations", async () => {
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const liveItems = [item("runtime:stack")];
		const onSceneReset = vi.fn();
		const Capture = () => {
			eventState.liveItems = liveItems;
			current = useTileMotionCues({ onSceneReset });
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
				originItemId: "runtime:producer",
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
				originItemId: "runtime:producer",
				location: liveItems[0].location,
				previousQuantity: 2,
				quantity: 3,
			},
		]);
		const second = current?.cues.get("runtime:stack");
		expect(second).toMatchObject({
			kind: "absorb",
			originItemId: "runtime:producer",
			strength: 2,
		});
		expect(second?.generation).not.toBe(first.generation);

		await act(async () => current?.complete("runtime:stack", first.generation));
		expect(current?.cues.get("runtime:stack")?.generation).toBe(second?.generation);
	});

	it("keeps hidden input consumption out of the visible actor grammar", async () => {
		const liveItems = [item("runtime:input")];
		eventState.liveItems = liveItems;
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({ onSceneReset: vi.fn() });
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));

		await dispatch([
			{
				type: GameEventEnumSchema.enum.ItemConsumed,
				sourceItemId: "runtime:input",
				canonicalItemId: "item:input",
				sourceLocation: {
					scope: "input",
					ownerItemId: "runtime:producer",
					lineId: "line:producer",
					inputIndex: 0,
				},
				previousQuantity: 2,
				consumedQuantity: 1,
				resultingQuantity: 1,
			},
		]);

		expect(current?.cues.size).toBe(0);
		expect(current?.retainedItems).toEqual([]);
	});

	it("pairs partial and full Autofill transfers with their exact receiver", async () => {
		let liveItems = [item("runtime:source", "board", 0, 2), item("runtime:owner")];
		eventState.liveItems = liveItems;
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({ onSceneReset: vi.fn() });
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));

		liveItems = [item("runtime:source", "board", 0, 1), item("runtime:owner")];
		await dispatch(
			[
				{
					type: GameEventEnumSchema.enum.ItemInputStored,
					sourceItemId: "runtime:source",
					canonicalItemId: "item:source",
					previousSourceLocation: item("runtime:source").location,
					previousQuantity: 2,
					storedQuantity: 1,
					resultingQuantity: 1,
					ownerItemId: "runtime:owner",
					lineId: "line:owner",
					inputIndex: 0,
				},
			],
			liveItems,
		);

		expect(current?.cues.get("runtime:source")).toMatchObject({
			kind: "consume",
			targetItemId: "runtime:owner",
			previousQuantity: 2,
		});
		expect(current?.cues.get("runtime:owner")).toMatchObject({
			kind: "accept",
		});
		expect(current?.retainedItems).toEqual([]);

		await dispatch(
			[
				{
					type: GameEventEnumSchema.enum.ItemInputStored,
					sourceItemId: "runtime:source",
					canonicalItemId: "item:source",
					previousSourceLocation: liveItems[0].location,
					previousQuantity: 1,
					storedQuantity: 1,
					resultingQuantity: 0,
					ownerItemId: "runtime:owner",
					lineId: "line:owner",
					inputIndex: 0,
				},
			],
			[item("runtime:owner")],
		);
		liveItems = [item("runtime:owner")];

		expect(current?.cues.get("runtime:source")).toMatchObject({
			kind: "consume-exit",
			targetItemId: "runtime:owner",
		});
		expect(current?.retainedItems.map((retained) => retained.id)).toEqual([
			"runtime:source",
		]);
	});

	it("preserves spawn first paint and promotes one bounded follow-up", async () => {
		const liveItems = [item("runtime:new")];
		eventState.liveItems = [];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({ onSceneReset: vi.fn() });
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));

		await dispatch(
			[
				{
					type: GameEventEnumSchema.enum.ItemSpawned,
					itemId: "runtime:new",
					canonicalItemId: "item:new",
					originItemId: "runtime:origin",
					location: liveItems[0].location,
					quantity: 1,
				},
				{
					type: GameEventEnumSchema.enum.ItemSplit,
					itemId: "runtime:new",
					canonicalItemId: "item:new",
					location: liveItems[0].location,
					previousQuantity: 2,
					quantity: 1,
				},
			],
			liveItems,
		);

		const spawn = current?.cues.get("runtime:new");
		expect(spawn?.kind).toBe("spawn");
		if (spawn === undefined) throw new Error("Missing spawn cue.");
		await act(async () => current?.complete("runtime:new", spawn.generation));
		expect(current?.cues.get("runtime:new")?.kind).toBe("impact");
	});

	it("orders impact before a stronger same-actor accept follow-up", async () => {
		const liveItems = [item("runtime:receiver")];
		eventState.liveItems = liveItems;
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({ onSceneReset: vi.fn() });
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));

		await dispatch([
			{
				type: GameEventEnumSchema.enum.ItemSplit,
				itemId: "runtime:receiver",
				canonicalItemId: "item:receiver",
				location: liveItems[0].location,
				previousQuantity: 2,
				quantity: 1,
			},
			{
				type: GameEventEnumSchema.enum.JobStarted,
				jobId: "runtime:job",
				ownerItemId: "runtime:receiver",
				lineId: "line:receiver",
				source: "explicit",
			},
		]);

		const impact = current?.cues.get("runtime:receiver");
		expect(impact?.kind).toBe("impact");
		if (impact === undefined) throw new Error("Missing impact cue.");
		await act(async () => current?.complete("runtime:receiver", impact.generation));
		expect(current?.cues.get("runtime:receiver")?.kind).toBe("accept");
	});

	it("arms fallback only after a visible cue actually starts", async () => {
		vi.useFakeTimers();
		const liveItems = [item("runtime:deferred")];
		eventState.liveItems = liveItems;
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({ onSceneReset: vi.fn() });
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));

		await dispatch([
			{
				type: GameEventEnumSchema.enum.ItemSplit,
				itemId: "runtime:deferred",
				canonicalItemId: "item:deferred",
				location: liveItems[0].location,
				previousQuantity: 2,
				quantity: 1,
			},
		]);
		const cue = current?.cues.get("runtime:deferred");
		if (cue === undefined) throw new Error("Missing deferred cue.");

		await act(async () => vi.advanceTimersByTimeAsync(2_100));
		expect(current?.cues.get("runtime:deferred")?.generation).toBe(cue.generation);

		await act(async () => current?.start("runtime:deferred", cue.generation));
		await act(async () => vi.advanceTimersByTimeAsync(2_100));
		expect(current?.cues.has("runtime:deferred")).toBe(false);
	});

	it("retains an outgoing actor only for its owned exit generation", async () => {
		let liveItems = [item("runtime:removed")];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const onSceneReset = vi.fn();
		const Capture = () => {
			eventState.liveItems = liveItems;
			current = useTileMotionCues({ onSceneReset });
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));
		await dispatch(
			[
				{
					type: GameEventEnumSchema.enum.ItemExpired,
					itemId: "runtime:removed",
					canonicalItemId: "item:removed",
					location: liveItems[0].location,
					quantity: 1,
				},
			],
			[],
		);
		liveItems = [];

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
			eventState.liveItems = liveItems;
			current = useTileMotionCues({ onSceneReset });
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));

		liveItems = [item("runtime:incoming")];
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
				originItemId: "runtime:outgoing",
				quantity: 1,
				location: liveItems[0].location,
			},
		], liveItems);

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
			eventState.liveItems = liveItems;
			current = useTileMotionCues({ onSceneReset });
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));
		await dispatch(
			[
				{
					type: GameEventEnumSchema.enum.ItemExpired,
					itemId: "runtime:fallback",
					canonicalItemId: "item:fallback",
					location: liveItems[0].location,
					quantity: 1,
				},
			],
			[],
		);
		liveItems = [];
		expect(current?.retainedItems).toHaveLength(1);
		const exit = current?.cues.get("runtime:fallback");
		if (exit === undefined) throw new Error("Missing fallback exit cue.");
		await act(async () => current?.start("runtime:fallback", exit.generation));

		await act(async () => vi.advanceTimersByTime(2_000));

		expect(current?.cues.size).toBe(0);
		expect(current?.retainedItems).toEqual([]);
	});

	it("clears cues, retained actors, and scene interaction when Game identity changes", async () => {
		let liveItems = [item("runtime:old-game")];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const onSceneReset = vi.fn();
		const Capture = () => {
			eventState.liveItems = liveItems;
			current = useTileMotionCues({ onSceneReset });
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

		liveItems = [];
		eventState.liveItems = liveItems;
		eventState.source = createTransitionSource();
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
			eventState.liveItems = liveItems;
			current = useTileMotionCues({ onSceneReset });
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
				originItemId: "runtime:producer",
				location: liveItems[0].location,
				quantity: 1,
			},
			{
				type: GameEventEnumSchema.enum.ItemSpawned,
				itemId: "runtime:inventory",
				canonicalItemId: "item:inventory",
				originItemId: "runtime:producer",
				location: liveItems[1].location,
				quantity: 1,
			},
		]);
		liveItems = [
			item("runtime:board:old"),
			item("runtime:board:new", "board", 1),
			item("runtime:inventory", "inventory"),
		];
		await dispatch(
			[
				{
					type: GameEventEnumSchema.enum.CurrentSpaceChanged,
					previousSpace: 0,
					currentSpace: 1,
				},
			],
			liveItems,
		);

		expect(onSceneReset).toHaveBeenCalledOnce();
		expect(current?.cues.has("runtime:board:old")).toBe(false);
		expect(current?.cues.get("runtime:board:new")?.kind).toBe("settle");
		expect(current?.cues.get("runtime:inventory")?.kind).toBe("spawn");
	});
});

describe("tile motion cue arbitration", () => {
	beforeEach(() => motionTestRuntime.reset());

	afterEach(async () => {
		await act(async () => {
			for (const root of roots.splice(0)) root.unmount();
		});
		document.body.replaceChildren();
	});

	const renderContent = async (
		phase: "hovered" | "dragging" | "exiting",
		onStart: ReturnType<typeof vi.fn>,
		onComplete: ReturnType<typeof vi.fn>,
	) => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(TileActorContent, {
					item: item("runtime:arbitrated"),
					registerActorNode: () => undefined,
					surfaceId: "board:0",
					live: true,
					exiting: phase === "exiting",
					phase,
					feedback: null,
					forbiddenDrop: false,
					cue: { generation: 21, kind: "impact", strength: 1 },
					cueOriginOffset: null,
					cueTargetOffset: null,
					onCueStart: onStart,
					onCueComplete: onComplete,
				}),
			);
		});
	};

	it("plays authoritative feedback over ordinary hover", async () => {
		const onStart = vi.fn();
		const onComplete = vi.fn();
		await renderContent("hovered", onStart, onComplete);

		expect(onStart).toHaveBeenCalledWith(21);
		expect(
			document.querySelector('[data-ui="TileMotionCueVisual"]')?.getAttribute(
				"data-motion-cue",
			),
		).toBe("impact");
		expect(onComplete).not.toHaveBeenCalled();
	});

	it("defers feedback while gesture settlement owns the actor", async () => {
		const onStart = vi.fn();
		const onComplete = vi.fn();
		await renderContent("dragging", onStart, onComplete);

		expect(onStart).not.toHaveBeenCalled();
		expect(onComplete).not.toHaveBeenCalled();
		expect(
			document.querySelector('[data-ui="TileMotionCueVisual"]')?.getAttribute(
				"data-motion-cue",
			),
		).toBeNull();
	});

	it("intentionally discards non-terminal feedback after interaction exit owns lifetime", async () => {
		const onStart = vi.fn();
		const onComplete = vi.fn();
		await renderContent("exiting", onStart, onComplete);

		expect(onStart).not.toHaveBeenCalled();
		expect(onComplete).toHaveBeenCalledWith(21);
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
						registerActorNode: () => undefined,
						surfaceId: "board:0",
						live: true,
						exiting: false,
						cue: { generation: 7, kind: "impact", strength: 2 },
						deliveryPayload: null,
						mode: "play",
						originOffset: null,
						targetOffset: null,
						transferPayload: null,
						onStart: vi.fn(),
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

	it("renders one truthful incoming stack payload from the recorded origin", async () => {
		motionTestRuntime.autoComplete = false;
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(
					TileMotionCueVisual,
					{
						registerActorNode: () => undefined,
						surfaceId: "board:0",
						live: true,
						exiting: false,
						cue: {
							deliveryQuantity: 2,
							generation: 8,
							kind: "absorb",
							originItemId: "runtime:producer",
							strength: 1,
						},
						deliveryPayload: createElement(
							"span",
							{ "data-ui": "TestDeliveryPayload" },
							"incoming",
						),
						mode: "play",
						originOffset: { x: -120, y: 40 },
						targetOffset: null,
						transferPayload: null,
						onStart: vi.fn(),
						onComplete: vi.fn(),
					},
					createElement("span", { "data-ui": "TestTarget" }, "target"),
				),
			);
		});

		expect(document.querySelector('[data-ui="TileMotionDeliveryPayload"]')).not.toBeNull();
		expect(document.querySelector('[data-ui="TestDeliveryPayload"]')?.textContent).toBe(
			"incoming",
		);
		expect(document.querySelectorAll('[data-ui="TestTarget"]')).toHaveLength(1);
	});

	it("renders one actor-local partial transfer face without a second stable identity", async () => {
		motionTestRuntime.autoComplete = false;
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(
					TileMotionCueVisual,
					{
						registerActorNode: () => undefined,
						surfaceId: "board:0",
						live: true,
						exiting: false,
						cue: {
							generation: 9,
							kind: "consume",
							previousQuantity: 2,
							strength: 1,
							targetItemId: "runtime:owner",
						},
						deliveryPayload: null,
						mode: "play",
						originOffset: null,
						targetOffset: { x: 120, y: 0 },
						transferPayload: createElement(
							"span",
							{ "data-ui": "TestPreviousQuantity" },
							"2",
						),
						onStart: vi.fn(),
						onComplete: vi.fn(),
					},
					createElement("span", { "data-ui": "TestCurrentQuantity" }, "1"),
				),
			);
		});

		expect(
			document.querySelector('[data-ui="TileMotionCueVisual"]')?.getAttribute(
				"data-motion-cue",
			),
		).toBe("consume");
		expect(document.querySelectorAll('[data-ui="TestPreviousQuantity"]')).toHaveLength(1);
		expect(document.querySelectorAll('[data-ui="TestCurrentQuantity"]')).toHaveLength(1);
	});

});
