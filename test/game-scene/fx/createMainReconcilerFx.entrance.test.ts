import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import { DropItemResultKind, DropItemRejectedReason } from "~/item-interaction/type/DropItemResult";
import {
	boardLocation,
	createActor,
	createItem,
	createMotion,
	createReconcilerHarness,
	projectionProbeState,
	transition,
} from "./createMainReconcilerFx.test/fixture";

it("reveals a late-mounted board in row order once and staggers a committed template reset", () => {
	vi.spyOn(performance, "now").mockReturnValue(1000);
	const harness = createReconcilerHarness({
		actor: createActor(createItem("old", boardLocation)),
	});
	vi.spyOn(harness.surface, "readActorPoseFx").mockImplementation((item) =>
		Effect.succeed({
			layer: harness.layer,
			size: 80,
			x: item.location.position.x,
			y: item.location.position.y,
		}),
	);
	const items = [
		createItem("bottom", {
			...boardLocation,
			position: {
				x: 0,
				y: 1,
			},
		}),
		createItem("right", {
			...boardLocation,
			position: {
				x: 1,
				y: 0,
			},
		}),
		createItem("left", {
			...boardLocation,
			position: {
				x: 0,
				y: 0,
			},
		}),
	];
	projectionProbeState.main = items;
	const initial = transition(10);
	Effect.runSync(harness.reconciler.hydrateFx(initial));
	expect(
		[
			"left",
			"right",
			"bottom",
		].map((id) => harness.actors.get(id)?.lifecycleNotBeforeMs),
	).toEqual([
		1000,
		1035,
		1070,
	]);
	const generations = items.map(({ id }) => harness.actors.get(id)?.lifecycleIntentGeneration);
	Effect.runSync(harness.reconciler.hydrateFx(initial));
	Effect.runSync(harness.reconciler.refreshVisualsFx);
	expect(items.map(({ id }) => harness.actors.get(id)?.lifecycleIntentGeneration)).toEqual(
		generations,
	);

	projectionProbeState.main = items.map((item) => ({
		...item,
		id: `${item.id}:new`,
	}));
	const applied = {
		...transition(11),
		events: [
			{
				type: "board:template-applied" as const,
				space: 0,
				templateUid: "same",
			},
		],
		runtime: {
			...initial.runtime,
			currentSpace: 0,
		},
		previousRuntime: {
			...initial.runtime,
			currentSpace: 0,
		},
	};
	Effect.runSync(harness.reconciler.reconcileFx(applied));
	expect(
		[
			"left:new",
			"right:new",
			"bottom:new",
		].map((id) => harness.actors.get(id)?.lifecycleNotBeforeMs),
	).toEqual([
		1000,
		1035,
		1070,
	]);
	const generation = harness.actors.get("bottom:new")?.lifecycleIntentGeneration;
	Effect.runSync(harness.reconciler.reconcileFx(applied));
	Effect.runSync(
		harness.reconciler.reconcileFx({
			...applied,
			sequence: 12,
			events: [
				{
					type: "board:template-applied",
					space: 1,
					templateUid: "other",
				},
			],
		}),
	);
	expect(harness.actors.get("bottom:new")?.lifecycleIntentGeneration).toBe(generation);
	vi.restoreAllMocks();
});

it("retires reset-space motion before new cues and never repeats it on refresh", () => {
	const calls: string[] = [];
	const motion = createMotion();
	const harness = createReconcilerHarness({
		actor: createActor(createItem("old", boardLocation)),
		motion: {
			...motion,
			cancelSpaceFx: (space) =>
				Effect.sync(() => {
					calls.push(`cancel:${space}`);
				}),
			enqueueFx: () =>
				Effect.sync(() => {
					calls.push("enqueue");
				}),
		},
	});
	const applied = {
		...transition(20),
		events: [
			{
				type: "board:template-applied" as const,
				space: 1,
				templateUid: "next",
			},
		],
	};
	Effect.runSync(harness.reconciler.hydrateFx(applied));
	expect(calls).toEqual([]);
	Effect.runSync(harness.reconciler.reconcileFx(applied));
	expect(calls).toEqual([
		"cancel:1",
		"enqueue",
	]);
	Effect.runSync(harness.reconciler.reconcileFx(applied));
	expect(calls).toEqual([
		"cancel:1",
		"enqueue",
		"enqueue",
	]);
});

it("hides retained source-space motion during a switch and restores the actor on return", () => {
	const item = createItem("moving-output", boardLocation);
	const actor = createActor(item);
	const canceledSpaces: number[] = [];
	const motion = createMotion();
	const harness = createReconcilerHarness({
		actor,
		motion: {
			...motion,
			cancelSpaceFx: (space) =>
				Effect.sync(() => {
					canceledSpaces.push(space);
				}),
			readSnapshotFx: Effect.succeed({
				interactionClaimByActorId: new Map(),
				retainedActorIds: new Set([
					item.id,
				]),
				spawnCueByActorId: new Map(),
			}),
		},
	});
	harness.transientActorLayer.addChild(actor.container);
	projectionProbeState.main = [];
	const switchTransition = transition(30);
	Effect.runSync(
		harness.reconciler.reconcileFx({
			...switchTransition,
			previousRuntime: {
				...switchTransition.runtime,
				currentSpace: 0,
			},
			runtime: {
				...switchTransition.runtime,
				currentSpace: 1,
			},
		}),
	);
	expect(canceledSpaces).toEqual([
		0,
	]);
	expect(actor.container.visible).toBe(false);

	projectionProbeState.main = [
		item,
	];
	const returnTransition = transition(31);
	Effect.runSync(
		harness.reconciler.reconcileFx({
			...returnTransition,
			previousRuntime: {
				...returnTransition.runtime,
				currentSpace: 1,
			},
			runtime: {
				...returnTransition.runtime,
				currentSpace: 0,
			},
		}),
	);
	expect(actor.container.visible).toBe(true);
});

it("replaces a pending source actor when its identity arrives in the next Space", () => {
	const item = createItem("transported", boardLocation);
	const actor = createActor(item);
	actor.dragging = true;
	actor.container.position.set(300, 250);
	const harness = createReconcilerHarness({
		actor,
	});
	const generation = Effect.runSync(
		harness.dropPresentation.beginFx({
			sourceActorId: item.id,
			swapCandidate: null,
		}),
	);
	const destinationItem = createItem(item.id, {
		...boardLocation,
		space: 1,
	});
	projectionProbeState.main = [
		destinationItem,
	];
	const switched = transition(40);
	const spaceSwitch = {
		...switched,
		previousRuntime: {
			...switched.runtime,
			currentSpace: 0,
		},
		runtime: {
			...switched.runtime,
			currentSpace: 1,
		},
	};
	Effect.runSync(harness.reconciler.reconcileFx(spaceSwitch));

	const arrival = harness.actors.get(item.id);
	expect(arrival).toBeDefined();
	expect(arrival).not.toBe(actor);
	expect(arrival?.item.location).toEqual(destinationItem.location);
	expect(arrival?.container.visible).toBe(true);
	expect(arrival?.container.x).toBe(40);
	expect(arrival?.container.y).toBe(60);
	expect(actor.container.destroyed).toBe(true);

	Effect.runSync(
		harness.dropPresentation.completeFx({
			generation,
			result: {
				kind: DropItemResultKind.Merge,
				action: "space",
				effect: "remove",
				source: {
					itemId: item.id,
					previousRevision: item.revision,
					previousLocation: item.location,
					current: {
						itemId: item.id,
						itemUid: item.itemUid,
						revision: destinationItem.revision,
						location: destinationItem.location,
					},
				},
				target: {
					itemId: "receiver",
					previousRevision: item.revision,
					previousLocation: item.location,
					current: null,
				},
			},
		}),
	);
	Effect.runSync(harness.reconciler.hydrateFx(spaceSwitch));
	expect(harness.actors.get(item.id)).toBe(arrival);
});

it("releases an offscreen source actor when its pending drop settles", () => {
	const item = createItem("offscreen", boardLocation);
	const actor = createActor(item);
	const harness = createReconcilerHarness({
		actor,
	});
	const generation = Effect.runSync(
		harness.dropPresentation.beginFx({
			sourceActorId: item.id,
			swapCandidate: null,
		}),
	);
	projectionProbeState.main = [];
	const switched = transition(50);
	const spaceSwitch = {
		...switched,
		previousRuntime: {
			...switched.runtime,
			currentSpace: 0,
		},
		runtime: {
			...switched.runtime,
			currentSpace: 1,
		},
	};
	Effect.runSync(harness.reconciler.reconcileFx(spaceSwitch));
	expect(harness.actors.get(item.id)).toBe(actor);
	expect(actor.container.visible).toBe(false);

	Effect.runSync(
		harness.dropPresentation.completeFx({
			generation,
			result: {
				kind: DropItemResultKind.Reject,
				itemId: item.id,
				reason: DropItemRejectedReason.StaleSource,
			},
		}),
	);
	Effect.runSync(harness.reconciler.hydrateFx(spaceSwitch));
	expect(harness.actors.has(item.id)).toBe(false);
	expect(actor.container.visible).toBe(false);
});
