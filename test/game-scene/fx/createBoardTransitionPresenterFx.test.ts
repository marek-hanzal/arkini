import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { GameTransition } from "~/game-session/type/GameSession";
import { createBoardTransitionPresenterFx } from "~/game-scene/fx/createBoardTransitionPresenterFx";
import type { PresentationRuntime } from "~/game-scene/service/PresentationRuntime";

const runtime = (currentSpace: number): GameTransition["runtime"] => ({
	cheats: {
		enabled: false,
		everEnabled: false,
		speedUpGameplay: false,
	},
	currentSpace,
	defaultLineByOwnerItemId: {},
	items: [],
	jobs: [],
	jobQueue: [],
	templateUidBySpace: {},
});

const transition = (
	sequence: number,
	space: number,
	events: GameTransition["events"] = [],
): GameTransition => ({
	sequence,
	previousRuntime: runtime(space),
	runtime: runtime(space),
	events,
});

const harness = () => {
	let latest = transition(0, 0);
	let finishExitFn: () => void = () => undefined;
	let finishEnterFn: () => void = () => undefined;
	let renderBarrierFn: () => void = () => undefined;
	const applied: string[] = [];
	const blocked: boolean[] = [];
	let exits = 0;
	let cancellations = 0;
	const presentation = {
		cancelAllFx: Effect.sync(() => {
			cancellations += 1;
		}),
		exitBoardFx: (onCompleteFn: () => void) =>
			Effect.sync(() => {
				finishExitFn = onCompleteFn;
			}),
		enterBoardFx: (onCompleteFn: () => void) =>
			Effect.sync(() => {
				finishEnterFn = onCompleteFn;
			}),
	} as unknown as PresentationRuntime;
	const presenter = Effect.runSync(
		createBoardTransitionPresenterFx({
			applyTransitionFn: (snapshot, mode) =>
				applied.push(`${snapshot.sequence}:${snapshot.runtime.currentSpace}:${mode}`),
			exitVisibleItemsFn: () => {
				exits += 1;
			},
			initialTransition: latest,
			presentation,
			readLatestTransitionFn: () => latest,
			scheduleAfterRenderFn: (workFn) => {
				renderBarrierFn = workFn;
				return () => {
					renderBarrierFn = () => undefined;
				};
			},
			setInteractionBlockedFn: (value) => blocked.push(value),
		}),
	);
	return {
		applied,
		blocked,
		get cancellations() {
			return cancellations;
		},
		get exits() {
			return exits;
		},
		finishEnterFn: () => finishEnterFn(),
		finishExitFn: () => finishExitFn(),
		presentFn: (snapshot: GameTransition) => {
			latest = snapshot;
			presenter.presentFn(snapshot);
		},
		renderBarrierFn: () => renderBarrierFn(),
		presenter,
	};
};

describe("Board transition presenter", () => {
	it("keeps one outgoing Board live and reveals only the latest destination", () => {
		const scene = harness();
		scene.presentFn(transition(1, 1));
		scene.presentFn(transition(2, 1));
		scene.presentFn(transition(3, 2));
		expect(scene.exits).toBe(1);
		expect(scene.applied).toEqual([
			"1:0:hydrate",
			"2:0:hydrate",
			"3:0:hydrate",
		]);
		expect(scene.blocked).toEqual([
			true,
		]);
		scene.finishExitFn();
		expect(scene.applied).toHaveLength(3);
		scene.renderBarrierFn();
		expect(scene.cancellations).toBe(1);
		expect(scene.applied.at(-1)).toBe("3:2:board-arrive");
		scene.finishEnterFn();
		expect(scene.blocked).toEqual([
			true,
			false,
		]);
	});

	it("treats Template reset as the same Board transition", () => {
		const scene = harness();
		scene.presentFn(
			transition(1, 0, [
				{
					type: "board:template-applied",
					space: 0,
					templateUid: "template:new",
				},
			]),
		);
		expect(scene.exits).toBe(1);
		expect(scene.applied).toEqual([]);
		scene.presentFn(transition(2, 0));
		expect(scene.applied).toEqual([]);
		scene.finishExitFn();
		scene.renderBarrierFn();
		expect(scene.applied).toEqual([
			"2:0:board-arrive",
		]);
	});

	it("freezes an entering Board after Template reset until its next whole-Board exit", () => {
		const scene = harness();
		scene.presentFn(transition(1, 1));
		scene.finishExitFn();
		scene.renderBarrierFn();
		const beforeReset = [
			...scene.applied,
		];
		scene.presentFn(
			transition(2, 1, [
				{
					type: "board:template-applied",
					space: 1,
					templateUid: "template:new",
				},
			]),
		);
		const tick = transition(3, 1);
		scene.presentFn(tick);
		scene.presenter.refreshFn(tick);
		expect(scene.applied).toEqual(beforeReset);
		scene.finishEnterFn();
		expect(scene.exits).toBe(2);
	});

	it("does not black out the Board again when a queued Space switch returns", () => {
		const scene = harness();
		scene.presentFn(transition(1, 1));
		scene.finishExitFn();
		scene.renderBarrierFn();
		scene.presentFn(transition(2, 2));
		scene.presentFn(transition(3, 1));
		expect(scene.applied.slice(-2)).toEqual([
			"2:1:hydrate",
			"3:1:present",
		]);
		scene.finishEnterFn();
		expect(scene.exits).toBe(1);
		expect(scene.blocked).toEqual([
			true,
			false,
		]);
	});
});
