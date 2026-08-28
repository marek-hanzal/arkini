import { describe, expect, it } from "vitest";

import type { GameTransition } from "~/renderer/game/session/GameSession";
import { readTileActorFeedbackCuesFn } from "~/ui/pixi/feedback/fn/readTileActorFeedbackCuesFn";

const boardLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 1,
		y: 2,
	},
};

const inputLocation = {
	scope: "input" as const,
	ownerItemId: "runtime:lumberjack",
	lineId: "line:lumberjack",
	inputIndex: 0,
};

describe("readTileActorFeedbackCuesFn", () => {
	it("derives receiver, charge, replacement and depletion-spawn feedback from exact facts", () => {
		const transition = {
			events: [
				{
					type: "item:charge-spent",
					itemId: "runtime:tree",
					canonicalItemId: "deposit:tree",
					location: boardLocation,
					previousCharges: 2,
					resultingCharges: 1,
				},
				{
					type: "job:started",
					jobId: "job:lumberjack",
					ownerItemId: "runtime:lumberjack",
					lineId: "line:lumberjack",
				},
				{
					type: "item:consumed",
					sourceItemId: "runtime:water",
					canonicalItemId: "item:water",
					sourceLocation: inputLocation,
					previousQuantity: 2,
					consumedQuantity: 1,
					resultingQuantity: 1,
				},
				{
					type: "item:merged",
					sourceItemId: "runtime:seed",
					sourceCanonicalItemId: "item:seed",
					targetItemId: "runtime:tree",
					targetCanonicalItemId: "deposit:sapling",
					action: "consume",
					effect: "replace",
					resultCanonicalItemId: "deposit:tree",
				},
				{
					type: "item:depleted",
					itemId: "runtime:tree",
					canonicalItemId: "deposit:tree",
					location: boardLocation,
					previousQuantity: 1,
					resultingQuantity: 0,
				},
				{
					type: "item:spawned",
					itemId: "runtime:new-seed",
					canonicalItemId: "item:seed",
					originItemId: "runtime:tree",
					location: boardLocation,
					quantity: 1,
				},
				{
					type: "item:input-stored",
					sourceItemId: "runtime:ore",
					canonicalItemId: "item:ore",
					previousSourceLocation: boardLocation,
					previousQuantity: 3,
					storedQuantity: 1,
					resultingQuantity: 2,
					ownerItemId: "runtime:smelter",
					lineId: "line:smelt",
					inputIndex: 0,
				},
			],
			previousRuntime: null,
			runtime: {
				cheats: {
					enabled: false,
					everEnabled: false,
					instantGameplay: false,
				},
				currentSpace: 0,
				items: [],
				jobs: [],

				jobQueue: [],
				defaultLineByOwnerItemId: {},
			},
			sequence: 12,
		} as GameTransition;

		expect(readTileActorFeedbackCuesFn(transition)).toEqual([
			{
				actorId: "runtime:tree",
				key: "12:0:resource-spent",
				kind: "resource-spent",
			},
			{
				actorId: "runtime:water",
				key: "12:2:consume-source",
				kind: "consume-source",
			},
			{
				actorId: "runtime:lumberjack",
				key: "12:2:consume",
				kind: "consume",
			},
			{
				actorId: "runtime:seed",
				key: "12:3:consume-source",
				kind: "consume-source",
			},
			{
				actorId: "runtime:tree",
				key: "12:3:replacement",
				kind: "replacement",
			},
			{
				actorId: "runtime:tree",
				key: "12:4:resource-spent",
				kind: "resource-spent",
			},
			{
				actorId: "runtime:new-seed",
				key: "12:5:replacement",
				kind: "replacement",
			},
			{
				actorId: "runtime:ore",
				key: "12:6:consume-source",
				kind: "consume-source",
			},
			{
				actorId: "runtime:smelter",
				key: "12:6:consume",
				kind: "consume",
			},
		]);
	});

	it("does not burst a producer that starts without consuming material", () => {
		const transition = {
			events: [
				{
					type: "job:started",
					jobId: "job:free",
					ownerItemId: "runtime:free-producer",
					lineId: "line:free",
				},
			],
			sequence: 13,
		} as GameTransition;

		expect(readTileActorFeedbackCuesFn(transition)).toEqual([]);
	});
});
