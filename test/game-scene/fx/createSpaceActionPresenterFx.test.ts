import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { GameTransition } from "~/game-session/type/GameSession";
import { createSpaceActionPresenterFx } from "~/game-scene/fx/createSpaceActionPresenterFx";

const runtime = (currentSpace: number): GameTransition["runtime"] => ({
	cheats: {
		enabled: false,
		everEnabled: false,
		instantGameplay: false,
	},
	currentSpace,
	items: [],
	jobs: [],
	jobQueue: [],
	defaultLineByOwnerItemId: {},
});

const spaceTransition = (sequence: number, previousSpace: number, currentSpace: number) => ({
	sequence,
	previousRuntime: runtime(previousSpace),
	runtime: runtime(currentSpace),
	events: [
		{
			type: "item:charge-spent" as const,
			itemId: `runtime:payer:${sequence}`,
			canonicalItemId: "payer",
			location: {
				scope: "board" as const,
				space: previousSpace,
				position: {
					x: 0,
					y: 0,
				},
			},
			previousCharges: 2,
			resultingCharges: 1,
		},
		{
			type: "current-space:changed" as const,
			previousSpace,
			currentSpace,
		},
	],
});

const ordinaryTransition = (sequence: number, currentSpace: number): GameTransition => ({
	sequence,
	previousRuntime: runtime(currentSpace),
	runtime: runtime(currentSpace),
	events: [],
});

describe("Space Action presenter", () => {
	it("preserves transition order and interaction ownership across exact render barriers", () => {
		const applied: string[] = [];
		const interactionBlocks: boolean[] = [];
		const frames: Array<{
			active: boolean;
			readonly work: () => void;
		}> = [];
		const presenter = Effect.runSync(
			createSpaceActionPresenterFx({
				applyTransitionFn: (transition) => {
					applied.push(
						`${transition.sequence}:${transition.runtime.currentSpace}:${transition.events
							.map((event) => event.type)
							.join(",")}`,
					);
				},
				initialSequence: 0,
				scheduleAfterRenderFn: (work) => {
					const frame = {
						active: true,
						work,
					};
					frames.push(frame);
					return () => {
						frame.active = false;
					};
				},
				setInteractionBlockedFn: (blocked) => interactionBlocks.push(blocked),
			}),
		);
		const runFrame = (index: number) => {
			const frame = frames[index];
			if (frame === undefined) throw new Error(`Frame ${index} is missing.`);
			if (frame.active) frame.work();
		};

		Effect.runSync(presenter.setInteractionBlockedFx(true));
		presenter.presentFn(spaceTransition(1, 0, 1), "present");
		presenter.presentFn(ordinaryTransition(2, 1), "present");
		presenter.presentFn(spaceTransition(3, 1, 2), "present");

		expect(applied).toEqual([
			"1:0:item:charge-spent",
		]);
		expect(interactionBlocks.at(-1)).toBe(true);

		runFrame(0);
		expect(applied).toEqual([
			"1:0:item:charge-spent",
			"1:1:current-space:changed",
			"2:1:",
			"3:1:item:charge-spent",
		]);

		Effect.runSync(presenter.setInteractionBlockedFx(false));
		expect(interactionBlocks.at(-1)).toBe(true);
		runFrame(1);
		expect(interactionBlocks.at(-1)).toBe(false);
		expect(applied.at(-1)).toBe("3:2:current-space:changed");

		presenter.presentFn(spaceTransition(4, 2, 3), "present");
		const appliedBeforeClose = [
			...applied,
		];
		Effect.runSync(presenter.closeFx);
		runFrame(2);

		expect(frames[2]?.active).toBe(false);
		expect(applied).toEqual(appliedBeforeClose);
	});

	it("ignores duplicate live delivery after an immediate refresh", () => {
		const applied: GameTransition[] = [];
		let renderAcknowledgment: () => void = () => undefined;
		const presenter = Effect.runSync(
			createSpaceActionPresenterFx({
				applyTransitionFn: (transition) => applied.push(transition),
				initialSequence: 0,
				scheduleAfterRenderFn: (work) => {
					renderAcknowledgment = work;
					return () => undefined;
				},
				setInteractionBlockedFn: () => undefined,
			}),
		);
		const overtakingSpace = spaceTransition(1, 0, 1);

		presenter.refreshFn(overtakingSpace);
		presenter.presentFn(overtakingSpace, "present");
		expect(applied.map((transition) => transition.events.map((event) => event.type))).toEqual([
			[
				"item:charge-spent",
			],
		]);

		renderAcknowledgment();
		presenter.refreshFn(overtakingSpace);

		expect(applied.map((transition) => transition.events.map((event) => event.type))).toEqual([
			[
				"item:charge-spent",
			],
			[
				"current-space:changed",
			],
		]);
	});

	it("does not let refresh skip an earlier Space presentation", () => {
		const applied: string[] = [];
		let renderAcknowledgment: () => void = () => undefined;
		const presenter = Effect.runSync(
			createSpaceActionPresenterFx({
				applyTransitionFn: (transition) => {
					applied.push(
						`${transition.sequence}:${transition.runtime.currentSpace}:${transition.events
							.map((event) => event.type)
							.join(",")}`,
					);
				},
				initialSequence: 0,
				scheduleAfterRenderFn: (work) => {
					renderAcknowledgment = work;
					return () => undefined;
				},
				setInteractionBlockedFn: () => undefined,
			}),
		);

		presenter.refreshFn(ordinaryTransition(2, 1));
		presenter.presentFn(spaceTransition(1, 0, 1), "present");
		presenter.presentFn(ordinaryTransition(2, 1), "present");

		expect(applied).toEqual([
			"1:0:item:charge-spent",
		]);

		renderAcknowledgment();

		expect(applied).toEqual([
			"1:0:item:charge-spent",
			"1:1:current-space:changed",
			"2:1:",
		]);
	});
});
