import { describe, expect, it } from "vitest";

import type { GameTransition } from "~/game-session/type/GameSession";
import { readSpaceTransitionPresentationPhasesFn } from "~/game-scene/fn/readSpaceTransitionPresentationPhasesFn";
import { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

const unitOwnerItem = {
	maxQueueSize: 1,
	lines: [],

	uid: "uid:tree",
	id: "tree",
	title: "Tree",
	description: "A spent source",
	artwork: {
		scale: 0.8,
		default: [
			"artwork:tree",
		],
	},
	units: {
		amount: 2,
	},
};

const payerLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 1,
		y: 2,
	},
};

const runtime = (currentSpace: number, remainingUnits?: number) =>
	RuntimeSchema.parse({
		cheats: {
			enabled: false,
			everEnabled: false,
			speedUpGameplay: false,
		},
		currentSpace,
		templateUidBySpace: {},
		items: [
			{
				id: "runtime:tree",
				item: unitOwnerItem,
				location: payerLocation,
				remainingUnits,
				revision: `revision:${remainingUnits ?? 2}`,
			},
		],
		jobs: [],
		jobQueue: [],
		defaultLineByOwnerItemId: {},
	});

describe("readSpaceTransitionPresentationPhasesFn", () => {
	it("projects final accounting on the source space before exposing the space switch", () => {
		const previousRuntime = runtime(0);
		const finalRuntime = runtime(3, 1);
		const transition = {
			sequence: 7,
			previousRuntime,
			runtime: finalRuntime,
			events: [
				{
					type: "item:unit-spent",
					itemId: "runtime:tree",
					canonicalItemId: "tree",
					location: payerLocation,
					previousUnits: 2,
					resultingUnits: 1,
				},
				{
					type: "current-space:changed",
					previousSpace: 0,
					currentSpace: 3,
				},
			],
		} satisfies GameTransition;

		const phases = readSpaceTransitionPresentationPhasesFn(transition);

		expect(phases).toHaveLength(2);
		expect(phases[0]).toMatchObject({
			kind: "accounting",
			transition: {
				events: [
					{
						type: "item:unit-spent",
					},
				],
				runtime: {
					currentSpace: 0,
					items: [
						{
							remainingUnits: 1,
						},
					],
				},
			},
		});
		expect(phases[1]).toMatchObject({
			kind: "space-switch",
			transition: {
				events: [
					{
						type: "current-space:changed",
					},
				],
				previousRuntime: {
					currentSpace: 0,
					items: [
						{
							remainingUnits: 1,
						},
					],
				},
				runtime: finalRuntime,
			},
		});
	});
});
