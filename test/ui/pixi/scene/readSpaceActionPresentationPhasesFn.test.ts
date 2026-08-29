import { describe, expect, it } from "vitest";

import type { GameTransition } from "~/renderer/game/session/GameSession";
import { readSpaceActionPresentationPhasesFn } from "~/ui/pixi/scene/fn/readSpaceActionPresentationPhasesFn";
import { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

const chargedItem = {
	uid: "uid:tree",
	id: "tree",
	title: "Tree",
	description: "A charged source",
	asset: {
		default: [
			"asset:tree",
		],
	},
	scope: "board",
	maxStackSize: 1,
	charges: {
		amount: 2,
	},
	type: "simple",
};

const payerLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 1,
		y: 2,
	},
};

const runtime = (currentSpace: number, remainingCharges?: number) =>
	RuntimeSchema.parse({
		cheats: {
			enabled: false,
			everEnabled: false,
			instantGameplay: false,
		},
		currentSpace,
		items: [
			{
				id: "runtime:tree",
				item: chargedItem,
				location: payerLocation,
				quantity: 1,
				remainingCharges,
				revision: `revision:${remainingCharges ?? 2}`,
			},
		],
		jobs: [],
		jobQueue: [],
		defaultLineByOwnerItemId: {},
	});

describe("readSpaceActionPresentationPhasesFn", () => {
	it("projects final accounting on the source space before exposing the space switch", () => {
		const previousRuntime = runtime(0);
		const finalRuntime = runtime(3, 1);
		const transition = {
			sequence: 7,
			previousRuntime,
			runtime: finalRuntime,
			events: [
				{
					type: "item:charge-spent",
					itemId: "runtime:tree",
					canonicalItemId: "tree",
					location: payerLocation,
					previousCharges: 2,
					resultingCharges: 1,
				},
				{
					type: "current-space:changed",
					previousSpace: 0,
					currentSpace: 3,
				},
			],
		} satisfies GameTransition;

		const phases = readSpaceActionPresentationPhasesFn(transition);

		expect(phases).toHaveLength(2);
		expect(phases[0]).toMatchObject({
			kind: "accounting",
			transition: {
				events: [
					{
						type: "item:charge-spent",
					},
				],
				runtime: {
					currentSpace: 0,
					items: [
						{
							remainingCharges: 1,
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
							remainingCharges: 1,
						},
					],
				},
				runtime: finalRuntime,
			},
		});
	});
});
