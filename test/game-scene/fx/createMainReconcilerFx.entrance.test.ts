import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import {
	boardLocation,
	createActor,
	createItem,
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
