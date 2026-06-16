import { describe, expect, it } from "vitest";
import type { ActivationResultSchema } from "~/v0/activation/type/ActivationResultSchema";
import { ActionVisualAnimation } from "~/v0/play/action/ActionVisualAnimation";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { resolveActivationDepletionFollowUp } from "~/v0/play/action/resolveActivationDepletionFollowUp";

const activation = {
	activationBoardItemId: "stash",
	placements: [],
} satisfies ActivationResultSchema.Type;

const sequencedSpawn = {
	type: "item.spawned",
	animation: ActionVisualAnimation.sequenceFadeIn({
		cause: "stash",
		groupId: "activation:stash:exhaust",
		sequenceIndex: 2,
	}),
	itemInstanceId: "spawned",
	itemId: "item:twig",
	reason: "activation-output",
	to: {
		kind: "board",
		x: 1,
		y: 2,
	},
} satisfies ActionVisualEventSchema.Type;

describe("resolveActivationDepletionFollowUp", () => {
	it("skips activations without depletion", () => {
		expect(
			resolveActivationDepletionFollowUp({
				activation,
				visualEvents: [],
			}),
		).toBeNull();
	});

	it("schedules depletion after sequenced visual events", () => {
		expect(
			resolveActivationDepletionFollowUp({
				activation: {
					...activation,
					depletion: {
						kind: "remove",
					},
				},
				bufferMs: 10,
				visualEvents: [
					sequencedSpawn,
				],
			}),
		).toEqual({
			boardItemId: "stash",
			delayMs: 830,
		});
	});
});
