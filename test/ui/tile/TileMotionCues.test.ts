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
import { readTileDeliveryTiming } from "~/ui/tile/readTileDeliveryTiming";
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
): TileActorTransitionSource => {
	let claimed = false;
	const current = (events: readTileActorTransitionFx.Result["events"]) => ({
		sequence: eventState.sequence,
		previousItems: null,
		liveItems: eventState.liveItems,
		events,
	});
	return {
		get initial() {
			return current([]);
		},
		claimCurrent: () => {
			const transition = current(claimed ? [] : initialEvents);
			claimed = true;
			return transition;
		},
		subscribe: (listener) => {
			eventState.listener = listener;
			return () => {
				if (eventState.listener === listener) eventState.listener = null;
			};
		},
	};
};

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
					position: {
						x: 0,
						y: 0,
					},
				}
			: {
					scope,
					position: {
						x: 0,
						y: 0,
					},
				},
	running: false,
	primaryAction: {
		kind: "none",
	},
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
		const liveItems = [
			item("runtime:initial-spawn"),
		];
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
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
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

	it("hydrates a remounted owner without replaying the already claimed current cue", async () => {
		const liveItems = [
			item("runtime:remount-spawn"),
		];
		eventState.liveItems = liveItems;
		eventState.source = createTransitionSource([
			{
				type: GameEventEnumSchema.enum.ItemSpawned,
				itemId: "runtime:remount-spawn",
				canonicalItemId: "item:remount-spawn",
				originItemId: "runtime:origin",
				location: liveItems[0].location,
				quantity: 1,
			},
		]);
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
			return null;
		};
		const firstContainer = document.createElement("div");
		document.body.append(firstContainer);
		const firstRoot = createRoot(firstContainer);
		roots.push(firstRoot);
		await act(async () => firstRoot.render(createElement(Capture)));
		expect(current?.cues.get("runtime:remount-spawn")?.kind).toBe("spawn");

		await act(async () => firstRoot.unmount());
		roots.splice(roots.indexOf(firstRoot), 1);
		current = null;

		const secondContainer = document.createElement("div");
		document.body.append(secondContainer);
		const secondRoot = createRoot(secondContainer);
		roots.push(secondRoot);
		await act(async () => secondRoot.render(createElement(Capture)));

		expect(current?.liveItems).toBe(liveItems);
		expect(current?.cues.size).toBe(0);
		expect(current?.retainedItems).toEqual([]);
	});

	it("does not rerender the actor layer for an empty transition with the same live projection", async () => {
		const liveItems = [
			item("runtime:stable"),
		];
		eventState.liveItems = liveItems;
		eventState.source = createTransitionSource();
		let renders = 0;
		const Capture = () => {
			renders += 1;
			useTileMotionCues({
				onSceneReset: vi.fn(),
			});
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
		const liveItems = [
			item("runtime:placed"),
		];
		const onSceneReset = vi.fn();
		const Capture = () => {
			eventState.liveItems = liveItems;
			current = useTileMotionCues({
				onSceneReset,
			});
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
		const liveItems = [
			item("runtime:stack"),
		];
		const onSceneReset = vi.fn();
		const Capture = () => {
			eventState.liveItems = liveItems;
			current = useTileMotionCues({
				onSceneReset,
			});
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

	it("keeps the oldest unpresented stack quantity through rapid additions", async () => {
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		eventState.liveItems = [
			item("runtime:stack", "board", 0, 1),
		];
		const Capture = () => {
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
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
					type: GameEventEnumSchema.enum.ItemStacked,
					itemId: "runtime:stack",
					canonicalItemId: "item:runtime:stack",
					originItemId: "runtime:producer",
					location: eventState.liveItems[0].location,
					previousQuantity: 1,
					quantity: 2,
				},
			],
			[
				item("runtime:stack", "board", 0, 2),
			],
		);
		const first = current?.cues.get("runtime:stack");
		if (first === undefined) throw new Error("Missing first stack cue.");

		await dispatch(
			[
				{
					type: GameEventEnumSchema.enum.ItemStacked,
					itemId: "runtime:stack",
					canonicalItemId: "item:runtime:stack",
					originItemId: "runtime:producer",
					location: eventState.liveItems[0].location,
					previousQuantity: 2,
					quantity: 3,
				},
			],
			[
				item("runtime:stack", "board", 0, 3),
			],
		);
		const second = current?.cues.get("runtime:stack");
		expect(second).toMatchObject({
			kind: "absorb",
			previousQuantity: 1,
			deliveryQuantity: 2,
			strength: 2,
		});
		expect(second?.generation).not.toBe(first.generation);

		await act(async () => {
			current?.contact("runtime:stack", first.generation);
			current?.complete("runtime:stack", first.generation);
		});
		expect(current?.cues.get("runtime:stack")).toMatchObject({
			generation: second?.generation,
			previousQuantity: 1,
		});
		expect(current?.cues.get("runtime:stack")).not.toHaveProperty("deliveryContacted");

		if (second === undefined) throw new Error("Missing coalesced stack cue.");
		await act(async () => current?.contact("runtime:stack", second.generation));
		expect(current?.cues.get("runtime:stack")).toMatchObject({
			generation: second.generation,
			deliveryContacted: true,
		});
	});

	it("serializes rapid stack deliveries from independent origins", async () => {
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		eventState.liveItems = [
			item("runtime:stack", "board", 0, 1),
		];
		const Capture = () => {
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
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
					type: GameEventEnumSchema.enum.ItemStacked,
					itemId: "runtime:stack",
					canonicalItemId: "item:runtime:stack",
					originItemId: "runtime:producer:a",
					location: eventState.liveItems[0].location,
					previousQuantity: 1,
					quantity: 2,
				},
			],
			[
				item("runtime:stack", "board", 0, 2),
			],
		);
		const first = current?.cues.get("runtime:stack");
		if (first === undefined) throw new Error("Missing first independent stack cue.");

		await dispatch(
			[
				{
					type: GameEventEnumSchema.enum.ItemStacked,
					itemId: "runtime:stack",
					canonicalItemId: "item:runtime:stack",
					originItemId: "runtime:producer:b",
					location: eventState.liveItems[0].location,
					previousQuantity: 2,
					quantity: 3,
				},
			],
			[
				item("runtime:stack", "board", 0, 3),
			],
		);
		expect(current?.cues.get("runtime:stack")).toMatchObject({
			generation: first.generation,
			kind: "absorb",
			originItemId: "runtime:producer:a",
			previousQuantity: 1,
			resultingQuantity: 2,
			deliveryQuantity: 1,
		});

		await act(async () => {
			current?.contact("runtime:stack", first.generation);
			current?.complete("runtime:stack", first.generation);
		});
		const second = current?.cues.get("runtime:stack");
		expect(second).toMatchObject({
			kind: "absorb",
			originItemId: "runtime:producer:b",
			previousQuantity: 2,
			resultingQuantity: 3,
			deliveryQuantity: 1,
		});
		if (second === undefined) throw new Error("Missing second independent stack cue.");

		await act(async () => current?.complete("runtime:stack", first.generation));
		expect(current?.cues.get("runtime:stack")?.generation).toBe(second.generation);
	});

	it("projects one surviving charge spend cue", async () => {
		const charged = item("runtime:charged");
		eventState.liveItems = [
			charged,
		];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));

		await dispatch([
			{
				type: GameEventEnumSchema.enum.ItemChargeSpent,
				itemId: charged.id,
				canonicalItemId: charged.itemId,
				location: charged.location,
				previousCharges: 3,
				resultingCharges: 2,
			},
		]);

		expect(current?.cues.get(charged.id)).toMatchObject({
			kind: "charge",
			strength: 1,
		});
		expect(current?.cues.size).toBe(1);
	});

	it("orders same-batch charge before split impact and ignores stale completion", async () => {
		const charged = item("runtime:charged-split", "board", 0, 2);
		eventState.liveItems = [
			charged,
		];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));

		await dispatch([
			{
				type: GameEventEnumSchema.enum.ItemChargeSpent,
				itemId: charged.id,
				canonicalItemId: charged.itemId,
				location: charged.location,
				previousCharges: 2,
				resultingCharges: 1,
			},
			{
				type: GameEventEnumSchema.enum.ItemSplit,
				itemId: charged.id,
				canonicalItemId: charged.itemId,
				location: charged.location,
				previousQuantity: 2,
				quantity: 1,
			},
		]);

		const charge = current?.cues.get(charged.id);
		expect(charge?.kind).toBe("charge");
		if (charge === undefined) throw new Error("Missing charge cue.");

		await act(async () => current?.complete(charged.id, charge.generation + 100));
		expect(current?.cues.get(charged.id)?.generation).toBe(charge.generation);

		await act(async () => current?.complete(charged.id, charge.generation));
		const impact = current?.cues.get(charged.id);
		expect(impact?.kind).toBe("impact");
		if (impact === undefined) throw new Error("Missing split impact follow-up.");

		await act(async () => current?.complete(charged.id, charge.generation));
		expect(current?.cues.get(charged.id)?.generation).toBe(impact.generation);
	});

	it("pulses only exact running and paused job-state edges", async () => {
		const running = {
			...item("runtime:state-pulse"),
			jobStatus: "running" as const,
			running: true,
		};
		eventState.liveItems = [
			running,
		];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));

		const paused = {
			...running,
			revision: "revision:paused",
			jobStatus: "paused" as const,
			running: false,
		};
		await dispatch(
			[],
			[
				paused,
			],
		);
		const pause = current?.cues.get(running.id);
		expect(pause?.kind).toBe("pause");
		if (pause === undefined) throw new Error("Missing pause cue.");
		await act(async () => current?.complete(running.id, pause.generation));

		const resumed = {
			...running,
			revision: "revision:resumed",
		};
		await dispatch(
			[],
			[
				resumed,
			],
		);
		expect(current?.cues.get(running.id)?.kind).toBe("resume");
	});

	it("does not pulse absent or awaiting-output job-state edges", async () => {
		const absent = item("runtime:no-state-pulse");
		eventState.liveItems = [
			absent,
		];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));

		const running = {
			...absent,
			revision: "revision:running",
			jobStatus: "running" as const,
			running: true,
		};
		await dispatch(
			[],
			[
				running,
			],
		);
		expect(current?.cues.has(absent.id)).toBe(false);

		const awaitingOutput = {
			...running,
			revision: "revision:awaiting-output",
			jobStatus: "awaiting-output" as const,
			running: false,
		};
		await dispatch(
			[],
			[
				awaitingOutput,
			],
		);
		expect(current?.cues.has(absent.id)).toBe(false);

		await dispatch(
			[],
			[
				{
					...running,
					revision: "revision:running-again",
				},
			],
		);
		expect(current?.cues.has(absent.id)).toBe(false);
	});

	it("morphs one preserved target identity from the oldest unseen face to the latest commit", async () => {
		const targetA = {
			...item("runtime:target"),
			itemId: "item:a",
			title: "A",
			sourceUrl: "asset://a",
		};
		const targetB = {
			...targetA,
			revision: "revision:b",
			itemId: "item:b",
			title: "B",
			sourceUrl: "asset://b",
		};
		const targetC = {
			...targetB,
			revision: "revision:c",
			itemId: "item:c",
			title: "C",
			sourceUrl: "asset://c",
		};
		eventState.liveItems = [
			targetA,
		];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
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
					type: GameEventEnumSchema.enum.ItemMerged,
					sourceItemId: "runtime:source",
					sourceCanonicalItemId: "item:source",
					targetItemId: targetA.id,
					targetCanonicalItemId: targetA.itemId,
					action: "consume",
					effect: "replace",
					resultCanonicalItemId: targetB.itemId,
				},
			],
			[
				targetB,
			],
		);
		const first = current?.cues.get(targetA.id);
		expect(first?.kind).toBe("morph");
		expect(current?.morphPreviousItems.get(targetA.id)?.item.itemId).toBe("item:a");

		await dispatch(
			[
				{
					type: GameEventEnumSchema.enum.ItemMerged,
					sourceItemId: "runtime:source:2",
					sourceCanonicalItemId: "item:source:2",
					targetItemId: targetA.id,
					targetCanonicalItemId: targetB.itemId,
					action: "consume",
					effect: "replace",
					resultCanonicalItemId: targetC.itemId,
				},
			],
			[
				targetC,
			],
		);
		const second = current?.cues.get(targetA.id);
		expect(second?.kind).toBe("morph");
		expect(second?.generation).not.toBe(first?.generation);
		expect(current?.morphPreviousItems.get(targetA.id)).toMatchObject({
			generation: second?.generation,
			item: {
				itemId: "item:a",
			},
		});

		if (first === undefined || second === undefined) {
			throw new Error("Missing rapid morph cues.");
		}
		await act(async () => current?.complete(targetA.id, first.generation));
		expect(current?.cues.get(targetA.id)?.generation).toBe(second.generation);
		expect(current?.morphPreviousItems.get(targetA.id)?.item.itemId).toBe("item:a");

		await act(async () => current?.complete(targetA.id, second.generation));
		expect(current?.cues.has(targetA.id)).toBe(false);
		expect(current?.morphPreviousItems.has(targetA.id)).toBe(false);
	});

	it("does not project Morph for keep, remove, or missing previous target snapshots", async () => {
		const target = {
			...item("runtime:target"),
			itemId: "item:target",
		};
		eventState.liveItems = [
			target,
		];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));

		for (const effect of [
			"keep",
			"remove",
		] as const) {
			await dispatch([
				{
					type: GameEventEnumSchema.enum.ItemMerged,
					sourceItemId: `runtime:source:${effect}`,
					sourceCanonicalItemId: `item:source:${effect}`,
					targetItemId: target.id,
					targetCanonicalItemId: target.itemId,
					action: "consume",
					effect,
				},
			]);
		}
		expect(current?.cues.size).toBe(0);
		expect(current?.morphPreviousItems.size).toBe(0);

		const listener = eventState.listener;
		if (listener === null) throw new Error("Missing committed-transition listener.");
		await act(async () => {
			listener({
				sequence: ++eventState.sequence,
				previousItems: null,
				liveItems: [
					{
						...target,
						itemId: "item:replacement",
					},
				],
				events: [
					{
						type: GameEventEnumSchema.enum.ItemMerged,
						sourceItemId: "runtime:source:replace",
						sourceCanonicalItemId: "item:source:replace",
						targetItemId: target.id,
						targetCanonicalItemId: target.itemId,
						action: "consume",
						effect: "replace",
						resultCanonicalItemId: "item:replacement",
					},
				],
			});
		});
		expect(current?.cues.size).toBe(0);
		expect(current?.morphPreviousItems.size).toBe(0);
	});

	it("drops deferred Morph projection on a board-space reset", async () => {
		const targetA = {
			...item("runtime:target"),
			itemId: "item:a",
		};
		const targetB = {
			...targetA,
			revision: "revision:b",
			itemId: "item:b",
		};
		eventState.liveItems = [
			targetA,
		];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
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
					type: GameEventEnumSchema.enum.ItemMerged,
					sourceItemId: "runtime:source",
					sourceCanonicalItemId: "item:source",
					targetItemId: targetA.id,
					targetCanonicalItemId: targetA.itemId,
					action: "consume",
					effect: "replace",
					resultCanonicalItemId: targetB.itemId,
				},
			],
			[
				targetB,
			],
		);
		expect(current?.cues.get(targetA.id)?.kind).toBe("morph");
		expect(current?.morphPreviousItems.has(targetA.id)).toBe(true);

		await dispatch(
			[
				{
					type: GameEventEnumSchema.enum.CurrentSpaceChanged,
					previousSpace: 0,
					currentSpace: 1,
				},
			],
			[],
		);
		expect(current?.cues.has(targetA.id)).toBe(false);
		expect(current?.morphPreviousItems.has(targetA.id)).toBe(false);
	});

	it("keeps hidden input consumption out of the visible actor grammar", async () => {
		const liveItems = [
			item("runtime:input"),
		];
		eventState.liveItems = liveItems;
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
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
		let liveItems = [
			item("runtime:source", "board", 0, 2),
			item("runtime:owner"),
		];
		eventState.liveItems = liveItems;
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));

		liveItems = [
			item("runtime:source", "board", 0, 1),
			item("runtime:owner"),
		];
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
			[
				item("runtime:owner"),
			],
		);
		liveItems = [
			item("runtime:owner"),
		];

		expect(current?.cues.get("runtime:source")).toMatchObject({
			kind: "consume-exit",
			targetItemId: "runtime:owner",
		});
		expect(current?.retainedItems.map((retained) => retained.id)).toEqual([
			"runtime:source",
		]);
	});

	it("preserves spawn first paint and promotes one bounded follow-up", async () => {
		const liveItems = [
			item("runtime:new"),
		];
		eventState.liveItems = [];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
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
		const liveItems = [
			item("runtime:receiver"),
		];
		eventState.liveItems = liveItems;
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
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
		const liveItems = [
			item("runtime:deferred"),
		];
		eventState.liveItems = liveItems;
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
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
		let liveItems = [
			item("runtime:removed"),
		];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const onSceneReset = vi.fn();
		const Capture = () => {
			eventState.liveItems = liveItems;
			current = useTileMotionCues({
				onSceneReset,
			});
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
		expect(exit?.kind).toBe("expiry");
		expect(current?.retainedItems.map((retained) => retained.id)).toEqual([
			"runtime:removed",
		]);
		if (exit === undefined) throw new Error("Missing exit cue.");
		await act(async () => current?.complete("runtime:removed", exit.generation));
		expect(current?.retainedItems).toEqual([]);
	});

	it("retains, centers, and cleans up an explicitly removed actor", async () => {
		const removed = item("runtime:explicitly-removed");
		eventState.liveItems = [
			removed,
		];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
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
					type: GameEventEnumSchema.enum.ItemExplicitlyRemoved,
					itemId: removed.id,
					canonicalItemId: removed.itemId,
					location: removed.location,
					quantity: 1,
				},
			],
			[],
		);

		const exit = current?.cues.get(removed.id);
		expect(exit?.kind).toBe("exit");
		expect(current?.retainedItems).toEqual([
			removed,
		]);
		if (exit === undefined) throw new Error("Missing explicit removal exit cue.");
		await act(async () => current?.complete(removed.id, exit.generation));
		expect(current?.cues.has(removed.id)).toBe(false);
		expect(current?.retainedItems).toEqual([]);
	});

	it("uses distinct surviving and terminal depletion cues", async () => {
		let liveItems = [
			item("runtime:deplete-survives", "board", 0, 2),
			item("runtime:deplete-exits"),
		];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			eventState.liveItems = liveItems;
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));

		const surviving = item("runtime:deplete-survives", "board", 0, 1);
		await dispatch(
			[
				{
					type: GameEventEnumSchema.enum.ItemDepleted,
					itemId: "runtime:deplete-survives",
					canonicalItemId: "item:deplete-survives",
					location: liveItems[0].location,
					previousQuantity: 2,
					resultingQuantity: 1,
				},
				{
					type: GameEventEnumSchema.enum.ItemDepleted,
					itemId: "runtime:deplete-exits",
					canonicalItemId: "item:deplete-exits",
					location: liveItems[1].location,
					previousQuantity: 1,
					resultingQuantity: 0,
				},
			],
			[
				surviving,
			],
		);
		liveItems = [
			surviving,
		];

		expect(current?.cues.get("runtime:deplete-survives")?.kind).toBe("deplete");
		expect(current?.cues.get("runtime:deplete-exits")?.kind).toBe("deplete-exit");
		expect(current?.retainedItems.map((candidate) => candidate.id)).toEqual([
			"runtime:deplete-exits",
		]);
	});

	it("pulses a surviving owner on job completion and lets terminal depletion win", async () => {
		let liveItems = [
			item("runtime:completed-owner"),
			item("runtime:spent-owner"),
		];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			eventState.liveItems = liveItems;
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
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
					type: GameEventEnumSchema.enum.JobCompleted,
					jobId: "job:completed",
					ownerItemId: "runtime:completed-owner",
					lineId: "line:completed",
				},
				{
					type: GameEventEnumSchema.enum.JobCompleted,
					jobId: "job:spent",
					ownerItemId: "runtime:spent-owner",
					lineId: "line:spent",
				},
				{
					type: GameEventEnumSchema.enum.ItemDepleted,
					itemId: "runtime:spent-owner",
					canonicalItemId: "item:spent-owner",
					location: liveItems[1].location,
					previousQuantity: 1,
					resultingQuantity: 0,
				},
			],
			[
				item("runtime:completed-owner"),
			],
		);
		liveItems = [
			item("runtime:completed-owner"),
		];

		expect(current?.cues.get("runtime:completed-owner")?.kind).toBe("complete");
		expect(current?.cues.get("runtime:spent-owner")?.kind).toBe("deplete-exit");
	});

	it("groups each completed producer with only its exact same-transition outputs", async () => {
		vi.useFakeTimers();
		const producerA = item("runtime:producer:a");
		const producerB = item("runtime:producer:b");
		const spawned = item("runtime:spawned");
		const stacked = item("runtime:stacked", "board", 0, 3);
		const unrelated = item("runtime:unrelated");
		let liveItems = [
			producerA,
			producerB,
			item("runtime:stacked", "board", 0, 2),
			unrelated,
		];
		eventState.liveItems = liveItems;
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));

		liveItems = [
			producerA,
			producerB,
			spawned,
			stacked,
			unrelated,
		];
		await dispatch(
			[
				{
					type: GameEventEnumSchema.enum.JobCompleted,
					jobId: "job:a",
					ownerItemId: producerA.id,
					lineId: "line:a",
				},
				{
					type: GameEventEnumSchema.enum.ItemSpawned,
					itemId: spawned.id,
					canonicalItemId: spawned.itemId,
					originItemId: producerA.id,
					location: spawned.location,
					quantity: 1,
				},
				{
					type: GameEventEnumSchema.enum.ItemStacked,
					itemId: stacked.id,
					canonicalItemId: stacked.itemId,
					originItemId: producerA.id,
					location: stacked.location,
					previousQuantity: 2,
					quantity: 3,
				},
				{
					type: GameEventEnumSchema.enum.ItemSpawned,
					itemId: unrelated.id,
					canonicalItemId: unrelated.itemId,
					originItemId: producerB.id,
					location: unrelated.location,
					quantity: 1,
				},
			],
			liveItems,
		);

		const producerCue = current?.cues.get(producerA.id);
		expect(producerCue).toMatchObject({
			kind: "complete",
			emissionTargetItemIds: [
				spawned.id,
				stacked.id,
			],
		});
		const emissionId = producerCue?.producerEmissionId;
		expect(emissionId).toBe(`${eventState.sequence}:${producerA.id}`);
		expect(current?.cues.get(spawned.id)).toMatchObject({
			kind: "spawn",
			originItemId: producerA.id,
			producerEmissionId: emissionId,
		});
		expect(current?.cues.get(stacked.id)).toMatchObject({
			kind: "absorb",
			originItemId: producerA.id,
			producerEmissionId: emissionId,
		});
		expect(current?.cues.get(unrelated.id)).toMatchObject({
			kind: "spawn",
			originItemId: producerB.id,
		});
		expect(current?.cues.get(unrelated.id)).not.toHaveProperty("producerEmissionId");
		expect(current?.cues.has(producerB.id)).toBe(false);
		if (producerCue === undefined) throw new Error("Missing exact producer cue.");

		await act(async () => current?.start(producerA.id, producerCue.generation));
		await act(async () => vi.advanceTimersByTimeAsync(119));
		expect(current?.cues.get(spawned.id)).not.toHaveProperty("producerEmissionReleased");
		expect(current?.cues.get(stacked.id)).not.toHaveProperty("producerEmissionReleased");

		await act(async () => vi.advanceTimersByTimeAsync(1));
		expect(current?.cues.get(spawned.id)?.producerEmissionReleased).toBe(true);
		expect(current?.cues.get(stacked.id)?.producerEmissionReleased).toBe(true);
		const timersAfterRelease = vi.getTimerCount();
		await act(async () => current?.start(producerA.id, producerCue.generation));
		expect(vi.getTimerCount()).toBe(timersAfterRelease);
	});

	it("waits for a producer complete follow-up to actually start before releasing output", async () => {
		vi.useFakeTimers();
		const producer = item("runtime:producer");
		const output = item("runtime:output");
		eventState.liveItems = [
			producer,
		];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
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
				itemId: producer.id,
				canonicalItemId: producer.itemId,
				originItemId: "runtime:older-origin",
				location: producer.location,
				quantity: 1,
			},
		]);
		const producerSpawn = current?.cues.get(producer.id);
		if (producerSpawn === undefined) throw new Error("Missing producer spawn cue.");

		await dispatch(
			[
				{
					type: GameEventEnumSchema.enum.JobCompleted,
					jobId: "job:producer",
					ownerItemId: producer.id,
					lineId: "line:producer",
				},
				{
					type: GameEventEnumSchema.enum.ItemSpawned,
					itemId: output.id,
					canonicalItemId: output.itemId,
					originItemId: producer.id,
					location: output.location,
					quantity: 1,
				},
			],
			[
				producer,
				output,
			],
		);

		expect(current?.cues.get(producer.id)?.kind).toBe("spawn");
		expect(current?.cues.get(output.id)?.producerEmissionReleased).toBeUndefined();
		await act(async () => current?.start(producer.id, producerSpawn.generation));
		await act(async () => vi.advanceTimersByTimeAsync(500));
		expect(current?.cues.get(output.id)?.producerEmissionReleased).toBeUndefined();

		await act(async () => current?.complete(producer.id, producerSpawn.generation));
		const producerComplete = current?.cues.get(producer.id);
		expect(producerComplete?.kind).toBe("complete");
		if (producerComplete === undefined) throw new Error("Missing producer follow-up.");
		await act(async () => current?.start(producer.id, producerComplete.generation));
		await act(async () => vi.advanceTimersByTimeAsync(120));

		expect(current?.cues.get(output.id)?.producerEmissionReleased).toBe(true);
	});

	it("rebinds rapid pending outputs to the latest coalesced producer gesture", async () => {
		vi.useFakeTimers();
		const producer = item("runtime:producer");
		const outputA = item("runtime:output:a");
		const outputB = item("runtime:output:b");
		eventState.liveItems = [
			producer,
		];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));

		const publish = async (jobId: string, output: useTileActors.Item) =>
			dispatch(
				[
					{
						type: GameEventEnumSchema.enum.JobCompleted,
						jobId,
						ownerItemId: producer.id,
						lineId: "line:producer",
					},
					{
						type: GameEventEnumSchema.enum.ItemSpawned,
						itemId: output.id,
						canonicalItemId: output.itemId,
						originItemId: producer.id,
						location: output.location,
						quantity: 1,
					},
				],
				[
					producer,
					outputA,
					...(output.id === outputB.id
						? [
								outputB,
							]
						: []),
				],
			);

		await publish("job:a", outputA);
		const firstProducer = current?.cues.get(producer.id);
		if (firstProducer === undefined) throw new Error("Missing first producer cue.");
		await act(async () => current?.start(producer.id, firstProducer.generation));
		await act(async () => vi.advanceTimersByTimeAsync(60));
		await publish("job:b", outputB);
		const coalescedProducer = current?.cues.get(producer.id);
		if (coalescedProducer === undefined) throw new Error("Missing coalesced producer cue.");

		expect(coalescedProducer).toMatchObject({
			kind: "complete",
			strength: 2,
			emissionTargetItemIds: [
				outputA.id,
				outputB.id,
			],
		});
		expect(coalescedProducer.generation).not.toBe(firstProducer.generation);
		expect(current?.cues.get(outputA.id)?.producerEmissionId).toBe(
			coalescedProducer.producerEmissionId,
		);
		expect(current?.cues.get(outputB.id)?.producerEmissionId).toBe(
			coalescedProducer.producerEmissionId,
		);

		await act(async () => vi.advanceTimersByTimeAsync(60));
		expect(current?.cues.get(outputA.id)?.producerEmissionReleased).toBeUndefined();
		await act(async () => current?.start(producer.id, coalescedProducer.generation));
		await act(async () => vi.advanceTimersByTimeAsync(120));
		expect(current?.cues.get(outputA.id)?.producerEmissionReleased).toBe(true);
		expect(current?.cues.get(outputB.id)?.producerEmissionReleased).toBe(true);
	});

	it("excludes an already released output from the next producer direction", async () => {
		vi.useFakeTimers();
		const producer = item("runtime:producer");
		const outputA = item("runtime:output:a");
		const outputB = item("runtime:output:b");
		eventState.liveItems = [
			producer,
		];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
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
					type: GameEventEnumSchema.enum.JobCompleted,
					jobId: "job:a",
					ownerItemId: producer.id,
					lineId: "line:producer",
				},
				{
					type: GameEventEnumSchema.enum.ItemSpawned,
					itemId: outputA.id,
					canonicalItemId: outputA.itemId,
					originItemId: producer.id,
					location: outputA.location,
					quantity: 1,
				},
			],
			[
				producer,
				outputA,
			],
		);
		const firstProducer = current?.cues.get(producer.id);
		if (firstProducer === undefined) throw new Error("Missing first producer cue.");
		const firstEmissionId = firstProducer.producerEmissionId;
		await act(async () => current?.start(producer.id, firstProducer.generation));
		await act(async () => vi.advanceTimersByTimeAsync(120));
		expect(current?.cues.get(outputA.id)).toMatchObject({
			producerEmissionId: firstEmissionId,
			producerEmissionReleased: true,
		});

		await dispatch(
			[
				{
					type: GameEventEnumSchema.enum.JobCompleted,
					jobId: "job:b",
					ownerItemId: producer.id,
					lineId: "line:producer",
				},
				{
					type: GameEventEnumSchema.enum.ItemSpawned,
					itemId: outputB.id,
					canonicalItemId: outputB.itemId,
					originItemId: producer.id,
					location: outputB.location,
					quantity: 1,
				},
			],
			[
				producer,
				outputA,
				outputB,
			],
		);
		const secondProducer = current?.cues.get(producer.id);
		expect(secondProducer?.emissionTargetItemIds).toEqual([
			outputB.id,
		]);
		expect(current?.cues.get(outputA.id)).toMatchObject({
			producerEmissionId: firstEmissionId,
			producerEmissionReleased: true,
		});
		expect(current?.cues.get(outputB.id)).toMatchObject({
			producerEmissionId: secondProducer?.producerEmissionId,
		});
		expect(current?.cues.get(outputB.id)?.producerEmissionReleased).toBeUndefined();
	});

	it("defers terminal external depletion outputs until the collapsing owner starts", async () => {
		vi.useFakeTimers();
		const producer = item("runtime:producer");
		const spawned = item("runtime:spawned");
		const stacked = item("runtime:stacked", "board", 0, 2);
		eventState.liveItems = [
			producer,
			item("runtime:stacked", "board", 0, 1),
		];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const Capture = () => {
			current = useTileMotionCues({
				onSceneReset: vi.fn(),
			});
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
					itemId: spawned.id,
					canonicalItemId: spawned.itemId,
					originItemId: producer.id,
					location: spawned.location,
					quantity: 1,
				},
				{
					type: GameEventEnumSchema.enum.ItemStacked,
					itemId: stacked.id,
					canonicalItemId: stacked.itemId,
					originItemId: producer.id,
					location: stacked.location,
					previousQuantity: 1,
					quantity: 2,
				},
				{
					type: GameEventEnumSchema.enum.ItemDepleted,
					itemId: producer.id,
					canonicalItemId: producer.itemId,
					location: producer.location,
					previousQuantity: 1,
					resultingQuantity: 0,
				},
			],
			[
				spawned,
				stacked,
			],
		);

		const terminal = current?.cues.get(producer.id);
		expect(terminal).toMatchObject({
			kind: "deplete-exit",
			emissionTargetItemIds: [
				spawned.id,
				stacked.id,
			],
		});
		expect(current?.cues.get(spawned.id)).toMatchObject({
			kind: "spawn",
			emissionFromCollapse: true,
			producerEmissionId: terminal?.producerEmissionId,
		});
		expect(current?.cues.get(stacked.id)).toMatchObject({
			kind: "absorb",
			emissionFromCollapse: true,
			producerEmissionId: terminal?.producerEmissionId,
		});
		expect(current?.cues.get(spawned.id)?.producerEmissionReleased).toBeUndefined();
		expect(current?.cues.get(stacked.id)?.producerEmissionReleased).toBeUndefined();
		if (terminal === undefined) throw new Error("Missing terminal emission owner.");

		await act(async () => current?.start(producer.id, terminal.generation));
		await act(async () => vi.advanceTimersByTimeAsync(119));
		expect(current?.cues.get(spawned.id)?.producerEmissionReleased).toBeUndefined();
		expect(current?.cues.get(stacked.id)?.producerEmissionReleased).toBeUndefined();
		await act(async () => vi.advanceTimersByTimeAsync(1));
		expect(current?.cues.get(spawned.id)?.producerEmissionReleased).toBe(true);
		expect(current?.cues.get(stacked.id)?.producerEmissionReleased).toBe(true);
	});

	it("coordinates independent outgoing expiry and incoming spawn when runtime publishes first", async () => {
		let liveItems = [
			item("runtime:outgoing"),
		];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const onSceneReset = vi.fn();
		const Capture = () => {
			eventState.liveItems = liveItems;
			current = useTileMotionCues({
				onSceneReset,
			});
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));

		liveItems = [
			item("runtime:incoming"),
		];
		await dispatch(
			[
				{
					type: GameEventEnumSchema.enum.ItemExpired,
					itemId: "runtime:outgoing",
					canonicalItemId: "item:outgoing",
					quantity: 1,
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
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
			],
			liveItems,
		);

		const exit = current?.cues.get("runtime:outgoing");
		expect(exit?.kind).toBe("expiry");
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
		let liveItems = [
			item("runtime:fallback"),
		];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const onSceneReset = vi.fn();
		const Capture = () => {
			eventState.liveItems = liveItems;
			current = useTileMotionCues({
				onSceneReset,
			});
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
		let liveItems = [
			item("runtime:old-game"),
		];
		let current: ReturnType<typeof useTileMotionCues> | null = null;
		const onSceneReset = vi.fn();
		const Capture = () => {
			eventState.liveItems = liveItems;
			current = useTileMotionCues({
				onSceneReset,
			});
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
			current = useTileMotionCues({
				onSceneReset,
			});
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
					surfaceId: "board:0",
					live: true,
					exiting: phase === "exiting",
					phase,
					feedback: null,
					forbiddenDrop: false,
					cue: {
						generation: 21,
						kind: "impact",
						strength: 1,
					},
					cueOriginOffset: null,
					cueTargetOffset: null,
					spawnDeliveryTiming: null,
					spawnDeliveryReady: true,
					onCueStart: onStart,
					onCueComplete: onComplete,
				}),
			);
		});
	};

	it("plays authoritative feedback over ordinary hover", async () => {
		motionTestRuntime.autoComplete = false;
		const onStart = vi.fn();
		const onComplete = vi.fn();
		await renderContent("hovered", onStart, onComplete);

		expect(onStart).toHaveBeenCalledWith(21);
		expect(
			document
				.querySelector('[data-ui="TileMotionCueVisual"]')
				?.getAttribute("data-motion-cue"),
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
			document
				.querySelector('[data-ui="TileMotionCueVisual"]')
				?.getAttribute("data-motion-cue"),
		).toBeNull();
	});

	it("intentionally discards non-terminal feedback after interaction exit owns lifetime", async () => {
		const onStart = vi.fn();
		const onComplete = vi.fn();
		await renderContent("exiting", onStart, onComplete);

		expect(onStart).not.toHaveBeenCalled();
		expect(onComplete).toHaveBeenCalledWith(21);
	});

	it("defers a correlated stack payload until its producer releases it", async () => {
		motionTestRuntime.autoComplete = false;
		const onStart = vi.fn();
		const onContact = vi.fn();
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const renderStack = async (released: boolean, contacted: boolean) => {
			await act(async () => {
				root.render(
					createElement(TileActorContent, {
						item: item("runtime:stack", "board", 0, 2),
						surfaceId: "board:0",
						live: true,
						exiting: false,
						phase: "hovered",
						feedback: null,
						forbiddenDrop: false,
						cue: {
							generation: 22,
							kind: "absorb",
							originItemId: "runtime:producer",
							producerEmissionId: "emission:22",
							previousQuantity: 1,
							resultingQuantity: 2,
							deliveryQuantity: 1,
							...(released
								? {
										producerEmissionReleased: true as const,
									}
								: {}),
							...(contacted
								? {
										deliveryContacted: true as const,
									}
								: {}),
							strength: 1,
						},
						cueOriginOffset: {
							x: -120,
							y: 0,
						},
						cueTargetOffset: null,
						spawnDeliveryTiming: null,
						spawnDeliveryReady: true,
						onCueStart: onStart,
						onCueContact: onContact,
						onCueComplete: vi.fn(),
					}),
				);
			});
		};

		await renderStack(false, false);
		expect(onStart).not.toHaveBeenCalled();
		expect(
			container
				.querySelector('[data-ui="TileMotionCueVisual"]')
				?.getAttribute("data-motion-cue"),
		).toBe("absorb-hold");
		expect(container.querySelector('[data-ui="TileMotionDeliveryPayload"]')).toBeNull();
		expect(
			container
				.querySelector('[data-ui="TileActorFace"]')
				?.getAttribute("data-tile-quantity"),
		).toBe("1");

		await renderStack(true, false);
		expect(onStart).toHaveBeenCalledWith(22);
		expect(
			container
				.querySelector('[data-ui="TileMotionAbsorbTarget"] [data-ui="TileActorFace"]')
				?.getAttribute("data-tile-quantity"),
		).toBe("1");
		expect(container.querySelector('[data-ui="TileMotionDeliveryPayload"]')).not.toBeNull();
		expect(onContact).not.toHaveBeenCalled();

		const payloadCompletionIndex = motionTestRuntime.completions.length - 1;
		await act(async () => motionTestRuntime.finish(payloadCompletionIndex));
		expect(onContact).toHaveBeenCalledWith(22);

		await renderStack(true, true);
		expect(
			container
				.querySelector('[data-ui="TileMotionAbsorbTarget"] [data-ui="TileActorFace"]')
				?.getAttribute("data-tile-quantity"),
		).toBe("2");
	});

	it("holds an accepted partial-store quantity through settlement and hands off at contact", async () => {
		motionTestRuntime.autoComplete = false;
		const storedItem = item("runtime:partial-store", "board", 0, 1);
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const renderStore = async (phase: "settling" | "hovered") => {
			await act(async () => {
				root.render(
					createElement(TileActorContent, {
						item: storedItem,
						surfaceId: "board:0",
						live: true,
						exiting: false,
						phase,
						feedback: null,
						forbiddenDrop: false,
						cue: {
							generation: 27,
							kind: "consume",
							previousQuantity: 2,
							strength: 1,
							targetItemId: "runtime:owner",
						},
						cueOriginOffset: null,
						cueTargetOffset: {
							x: 120,
							y: 0,
						},
						spawnDeliveryTiming: null,
						spawnDeliveryReady: true,
						onCueStart: vi.fn(),
						onCueComplete: vi.fn(),
					}),
				);
			});
		};

		await renderStore("settling");
		expect(
			container
				.querySelector('[data-ui="TileMotionCueVisual"]')
				?.getAttribute("data-motion-cue"),
		).toBe("consume-hold");
		expect(container.querySelectorAll('[data-ui="TileActorFace"]')).toHaveLength(1);
		expect(
			container
				.querySelector('[data-ui="TileActorFace"]')
				?.getAttribute("data-tile-quantity"),
		).toBe("2");

		await renderStore("hovered");
		const transfer = container.querySelector('[data-ui="TileMotionCueVisual"]');
		expect(transfer?.getAttribute("data-motion-cue")).toBe("consume");
		expect(transfer?.getAttribute("data-motion-transfer-contact")).toBe("0.5");
		expect(
			container
				.querySelector('[data-ui="TileMotionTransferPrevious"]')
				?.getAttribute("data-motion-times"),
		).toBe("0,0.5,0.5,1");
		expect(
			container
				.querySelector('[data-ui="TileMotionTransferCurrent"]')
				?.getAttribute("data-motion-times"),
		).toBe("0,0.5,0.5,1");
		expect(
			container.querySelector('[data-ui="TileMotionTransferPrevious"]')?.textContent,
		).toContain("2");
		expect(
			container.querySelector('[data-ui="TileMotionTransferCurrent"]')?.textContent,
		).not.toContain("2");
	});

	it("holds the previous Replace face through settling and hands off on one actor visual", async () => {
		motionTestRuntime.autoComplete = false;
		const previousItem = {
			...item("runtime:morph"),
			itemId: "item:tree",
			title: "Tree",
			sourceUrl: "asset://tree",
		};
		const committedItem = {
			...previousItem,
			revision: "revision:forest",
			itemId: "item:forest",
			title: "Forest",
			sourceUrl: "asset://forest",
		};
		const cue = {
			generation: 23,
			kind: "morph" as const,
			strength: 1,
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const renderMorph = async (phase: "settling" | "hovered") => {
			await act(async () => {
				root.render(
					createElement(TileActorContent, {
						item: committedItem,
						morphPreviousItem: previousItem,
						surfaceId: "board:0",
						live: true,
						exiting: false,
						phase,
						feedback: null,
						forbiddenDrop: false,
						cue,
						cueOriginOffset: null,
						cueTargetOffset: null,
						spawnDeliveryTiming: null,
						spawnDeliveryReady: true,
						onCueStart: vi.fn(),
						onCueComplete: vi.fn(),
					}),
				);
			});
		};

		await renderMorph("settling");
		expect(container.querySelectorAll('[data-ui="TileActorVisual"]')).toHaveLength(1);
		expect(
			container
				.querySelector('[data-ui="TileMotionCueVisual"]')
				?.getAttribute("data-motion-cue"),
		).toBe("morph-hold");
		expect(container.querySelector('[data-ui="TileActorTitle"]')?.textContent).toBe("Tree");
		expect(container.textContent).not.toContain("Forest");

		await renderMorph("hovered");
		expect(container.querySelectorAll('[data-ui="TileActorVisual"]')).toHaveLength(1);
		expect(
			container
				.querySelector('[data-ui="TileMotionCueVisual"]')
				?.getAttribute("data-motion-cue"),
		).toBe("morph");
		expect(container.querySelectorAll('[data-ui="TileMotionMorphPrevious"]')).toHaveLength(1);
		expect(container.querySelectorAll('[data-ui="TileMotionMorphCurrent"]')).toHaveLength(1);
		expect(
			container.querySelector('[data-ui="TileMotionMorphPrevious"]')?.textContent,
		).toContain("Tree");
		expect(
			container.querySelector('[data-ui="TileMotionMorphCurrent"]')?.textContent,
		).toContain("Forest");
	});

	it("reveals committed stack quantity at the exact delivery contact", async () => {
		motionTestRuntime.autoComplete = false;
		const originOffset = {
			x: -160,
			y: 0,
		};
		const timing = readTileDeliveryTiming({
			offset: originOffset,
		});
		const onContact = vi.fn();
		const stackedItem = item("runtime:stack", "board", 0, 3);
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const renderStack = async (deliveryContacted: boolean) => {
			await act(async () => {
				root.render(
					createElement(TileActorContent, {
						item: stackedItem,
						surfaceId: "board:0",
						live: true,
						exiting: false,
						phase: "hovered",
						feedback: null,
						forbiddenDrop: false,
						cue: {
							generation: 24,
							kind: "absorb",
							originItemId: "runtime:producer",
							previousQuantity: 1,
							deliveryQuantity: 2,
							...(deliveryContacted
								? {
										deliveryContacted: true as const,
									}
								: {}),
							strength: 2,
						},
						cueOriginOffset: originOffset,
						cueTargetOffset: null,
						spawnDeliveryTiming: null,
						spawnDeliveryReady: true,
						onCueStart: vi.fn(),
						onCueContact: onContact,
						onCueComplete: vi.fn(),
					}),
				);
			});
		};

		await renderStack(false);
		expect(
			container
				.querySelector('[data-ui="TileMotionAbsorbTarget"] [data-ui="TileActorFace"]')
				?.getAttribute("data-tile-quantity"),
		).toBe("1");
		expect(container.textContent).not.toContain("3");
		expect(onContact).not.toHaveBeenCalled();
		expect(
			container
				.querySelector('[data-ui="TileMotionAbsorbTarget"]')
				?.getAttribute("data-motion-contact-delay"),
		).toBe(String(timing.contactDelay));
		const payloadCompletionIndex = motionTestRuntime.completions.length - 1;
		await act(async () => {
			motionTestRuntime.finish(payloadCompletionIndex);
		});
		expect(onContact).toHaveBeenCalledOnce();
		expect(onContact).toHaveBeenCalledWith(24);

		await renderStack(true);
		expect(
			container
				.querySelector('[data-ui="TileMotionAbsorbTarget"] [data-ui="TileActorFace"]')
				?.getAttribute("data-tile-quantity"),
		).toBe("3");
	});

	it("commits pending stack quantity immediately without travel geometry or full motion", async () => {
		const onContact = vi.fn();
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(TileActorContent, {
					item: item("runtime:fallback", "board", 0, 2),
					surfaceId: "board:0",
					live: true,
					exiting: false,
					phase: "hovered",
					feedback: null,
					forbiddenDrop: false,
					cue: {
						generation: 25,
						kind: "absorb",
						originItemId: "runtime:missing",
						previousQuantity: 1,
						deliveryQuantity: 1,
						strength: 1,
					},
					cueOriginOffset: null,
					cueTargetOffset: null,
					spawnDeliveryTiming: null,
					spawnDeliveryReady: true,
					onCueStart: vi.fn(),
					onCueContact: onContact,
					onCueComplete: vi.fn(),
				}),
			);
		});
		expect(onContact).toHaveBeenCalledOnce();
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

	it("holds a pending delivered spawn compact and enters on the same shell at arrival", async () => {
		motionTestRuntime.autoComplete = false;
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const cue: TileMotionCueSchema.Type = {
			generation: 6,
			kind: "spawn",
			originItemId: "runtime:producer",
			strength: 1,
		};
		const timing = readTileDeliveryTiming({
			offset: {
				x: -180,
				y: 0,
			},
		});
		const renderSpawn = async (mode: TileMotionCueVisual.Mode, spawnDeliveryReady: boolean) => {
			await act(async () => {
				root.render(
					createElement(
						TileMotionCueVisual,
						{
							surfaceId: "board:0",
							live: true,
							exiting: false,
							cue,
							deliveryPayload: null,
							mode,
							originOffset: null,
							targetOffset: null,
							spawnDeliveryTiming: timing,
							spawnDeliveryReady,
							transferPayload: null,
							onStart: vi.fn(),
							onComplete: vi.fn(),
						},
						createElement("span", null, "tile"),
					),
				);
			});
		};

		await renderSpawn("defer", false);
		const hold = container.querySelector('[data-ui="TileMotionCueVisual"]');
		expect(hold?.getAttribute("data-motion-cue")).toBe("spawn-hold");
		expect(hold?.getAttribute("data-motion-scale")).toBe("0.74");

		await renderSpawn("play", true);
		const enter = container.querySelector('[data-ui="TileMotionCueVisual"]');
		expect(enter).toBe(hold);
		expect(enter?.getAttribute("data-motion-cue")).toBe("spawn");
		expect(enter?.getAttribute("data-motion-contact-delay")).toBe("0");
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
						surfaceId: "board:0",
						live: true,
						exiting: false,
						cue: {
							generation: 7,
							kind: "impact",
							strength: 2,
						},
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
			document
				.querySelector('[data-ui="TileMotionCueVisual"]')
				?.getAttribute("data-motion-cue"),
		).toBe("impact");
		expect(completed).toEqual([]);
		await act(async () => motionTestRuntime.finish(0));
		expect(completed).toEqual([
			7,
		]);
	});

	it("squashes and recoils a producer toward the exact canonical output direction", async () => {
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
						surfaceId: "board:0",
						live: true,
						exiting: false,
						cue: {
							generation: 7,
							kind: "complete",
							emissionTargetItemIds: [
								"runtime:output",
							],
							producerEmissionId: "emission:7",
							strength: 1,
						},
						deliveryPayload: null,
						mode: "play",
						originOffset: null,
						targetOffset: {
							x: 200,
							y: 0,
						},
						transferPayload: null,
						onStart: vi.fn(),
						onComplete: vi.fn(),
					},
					createElement("span", null, "producer"),
				),
			);
		});

		const producer = container.querySelector('[data-ui="TileMotionCueVisual"]');
		expect(producer?.getAttribute("data-motion-emission-direction")).toBe("1,0");
		expect(producer?.getAttribute("data-motion-emission-release-delay")).toBe("0.12");
		const duration = Number(producer?.getAttribute("data-motion-emission-duration"));
		const times = producer?.getAttribute("data-motion-times")?.split(",").map(Number);
		expect((times?.[2] ?? 0) * duration).toBe(0.12);
		expect(producer?.getAttribute("data-motion-scale-x")).toBe("1,0.9,0.9,1.03,1");
		expect(producer?.getAttribute("data-motion-scale-y")).toBe("1,1.06,1.06,1.03,1");
	});

	it("renders one truthful incoming stack payload from the recorded origin", async () => {
		motionTestRuntime.autoComplete = false;
		const onComplete = vi.fn();
		const originOffset = {
			x: -120,
			y: 40,
		};
		const timing = readTileDeliveryTiming({
			offset: originOffset,
		});
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(
					TileMotionCueVisual,
					{
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
							{
								"data-ui": "TestDeliveryPayload",
							},
							"incoming",
						),
						mode: "play",
						originOffset,
						targetOffset: null,
						transferPayload: null,
						onStart: vi.fn(),
						onComplete,
					},
					createElement(
						"span",
						{
							"data-ui": "TestTarget",
						},
						"target",
					),
				),
			);
		});

		const payload = document.querySelector('[data-ui="TileMotionDeliveryPayload"]');
		const target = document.querySelector('[data-ui="TileMotionAbsorbTarget"]');
		expect(payload).not.toBeNull();
		expect(payload?.getAttribute("data-motion-travel-duration")).toBe(
			String(timing.travelDuration),
		);
		expect(target?.getAttribute("data-motion-contact-delay")).toBe(String(timing.contactDelay));
		expect(target?.getAttribute("data-motion-scale")).toBeNull();
		expect(target?.getAttribute("data-motion-scale-x")).toBe("1,0.9,1.08,1");
		expect(target?.getAttribute("data-motion-scale-y")).toBe("1,1.06,1,1");
		const directionalRotation = target
			?.getAttribute("data-motion-rotate")
			?.split(",")
			.map(Number);
		expect(directionalRotation?.[0]).toBe(0);
		expect(directionalRotation?.[1]).toBeLessThan(0);
		expect(directionalRotation?.[2]).toBeGreaterThan(0);
		expect(directionalRotation?.[3]).toBe(0);
		expect(document.querySelector('[data-ui="TestDeliveryPayload"]')?.textContent).toBe(
			"incoming",
		);
		expect(document.querySelectorAll('[data-ui="TestTarget"]')).toHaveLength(1);
		expect(onComplete).not.toHaveBeenCalled();

		await act(async () => motionTestRuntime.finish(0));
		expect(onComplete).toHaveBeenCalledOnce();
		expect(onComplete).toHaveBeenCalledWith(8);
	});

	it("keeps local absorb feedback immediate without a spatial payload", async () => {
		const renderAbsorb = async ({
			generation,
			originOffset,
		}: {
			readonly generation: number;
			readonly originOffset: {
				readonly x: number;
				readonly y: number;
			} | null;
		}) => {
			const onComplete = vi.fn();
			const container = document.createElement("div");
			document.body.append(container);
			const root = createRoot(container);
			roots.push(root);
			await act(async () => {
				root.render(
					createElement(
						TileMotionCueVisual,
						{
							surfaceId: "board:0",
							live: true,
							exiting: false,
							cue: {
								deliveryQuantity: 1,
								generation,
								kind: "absorb",
								originItemId: "runtime:producer",
								strength: 1,
							},
							deliveryPayload: createElement("span", null, "incoming"),
							mode: "play",
							originOffset,
							targetOffset: null,
							transferPayload: null,
							onStart: vi.fn(),
							onComplete,
						},
						createElement("span", null, "target"),
					),
				);
				await Promise.resolve();
			});
			return {
				onComplete,
				payload: container.querySelector('[data-ui="TileMotionDeliveryPayload"]'),
				target: container.querySelector('[data-ui="TileMotionAbsorbTarget"]'),
			};
		};

		const local = await renderAbsorb({
			generation: 9,
			originOffset: null,
		});
		expect(local.payload).toBeNull();
		expect(local.target?.getAttribute("data-motion-contact-delay")).toBe("0");
		expect(local.target?.getAttribute("data-motion-scale")).toBe("1,0.75,1.08,1");
		expect(local.onComplete).toHaveBeenCalledWith(9);
	});

	it("keeps completion, depletion, and expiry physically distinct", async () => {
		motionTestRuntime.autoComplete = false;
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		const renderCue = async (
			kind: "complete" | "deplete" | "deplete-exit" | "expiry",
			generation: number,
		) => {
			await act(async () => {
				root.render(
					createElement(
						TileMotionCueVisual,
						{
							surfaceId: "board:0",
							live: kind !== "deplete-exit" && kind !== "expiry",
							exiting: kind === "deplete-exit" || kind === "expiry",
							cue: {
								generation,
								kind,
								strength: 1,
							},
							deliveryPayload: null,
							mode: "play",
							originOffset: null,
							targetOffset: null,
							transferPayload: null,
							onStart: vi.fn(),
							onComplete: vi.fn(),
						},
						createElement("span", null, kind),
					),
				);
			});
			const visual = document.querySelector('[data-ui="TileMotionCueVisual"]');
			return {
				kind: visual?.getAttribute("data-motion-cue"),
				scale: visual?.getAttribute("data-motion-scale"),
			};
		};

		expect(await renderCue("complete", 30)).toEqual({
			kind: "complete",
			scale: "1,0.88,1.1,1",
		});
		expect(await renderCue("deplete", 31)).toEqual({
			kind: "deplete",
			scale: "1,0.9,0.98,1",
		});
		expect(await renderCue("deplete-exit", 32)).toEqual({
			kind: "deplete-exit",
			scale: "1,0.96,0.54",
		});
		expect(await renderCue("expiry", 33)).toEqual({
			kind: "expiry",
			scale: "1,0.97,0.78",
		});
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
						targetOffset: {
							x: 120,
							y: 0,
						},
						transferPayload: createElement(
							"span",
							{
								"data-ui": "TestPreviousQuantity",
							},
							"2",
						),
						onStart: vi.fn(),
						onComplete: vi.fn(),
					},
					createElement(
						"span",
						{
							"data-ui": "TestCurrentQuantity",
						},
						"1",
					),
				),
			);
		});

		expect(
			document
				.querySelector('[data-ui="TileMotionCueVisual"]')
				?.getAttribute("data-motion-cue"),
		).toBe("consume");
		expect(document.querySelectorAll('[data-ui="TestPreviousQuantity"]')).toHaveLength(1);
		expect(document.querySelectorAll('[data-ui="TestCurrentQuantity"]')).toHaveLength(1);
	});
});
