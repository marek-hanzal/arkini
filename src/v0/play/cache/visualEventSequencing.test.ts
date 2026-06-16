import { describe, expect, it } from "vitest";
import { ActionVisualAnimation } from "~/v0/play/action/ActionVisualAnimation";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import {
	sequenceCompletionDelayMs,
	shouldSequenceSpawnVisualEvents,
	spawnSequenceDelayMs,
	toImmediateSequencedVisualEvent,
} from "~/v0/play/cache/sequenceSpawnVisualEvents";

const boardLocation = (x: number, y: number) =>
	({
		kind: "board",
		x,
		y,
	}) as const;

describe("visual event sequencing", () => {
	it("keeps swap events as one parallel animation contract", () => {
		const events = [
			{
				type: "item.swapped",
				animation: ActionVisualAnimation.parallelMove({
					cause: "swap",
					groupId: "swap:source:target",
				}),
				sourceItemInstanceId: "source",
				sourceItemId: "item:twig",
				sourceFrom: boardLocation(2, 4),
				sourceTo: boardLocation(4, 4),
				targetItemInstanceId: "target",
				targetItemId: "item:pebble",
				targetFrom: boardLocation(4, 4),
				targetTo: boardLocation(2, 4),
			},
		] satisfies ActionVisualEventSchema.Type[];

		expect(shouldSequenceSpawnVisualEvents(events)).toBe(false);
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			type: "item.swapped",
			animation: {
				cause: "swap",
				effect: "move",
				groupId: "swap:source:target",
				mode: "parallel",
			},
			sourceTo: boardLocation(4, 4),
			targetTo: boardLocation(2, 4),
		});
	});

	it("sequences normal producer spawn batches instead of dumping the whole batch instantly", () => {
		const events = [
			{
				type: "activation.activated",
				itemInstanceId: "producer",
				mode: "single",
			},
			{
				type: "item.spawned",
				animation: ActionVisualAnimation.sequenceFadeIn({
					cause: "producer",
					groupId: "activation:producer:single",
					sequenceIndex: 0,
				}),
				itemInstanceId: "spawned-a",
				itemId: "item:twig",
				originItemInstanceId: "producer",
				to: boardLocation(3, 3),
				reason: "activation-output",
			},
			{
				type: "item.spawned",
				animation: ActionVisualAnimation.sequenceFadeIn({
					cause: "producer",
					groupId: "activation:producer:single",
					sequenceIndex: 1,
				}),
				itemInstanceId: "spawned-b",
				itemId: "item:branch",
				originItemInstanceId: "producer",
				to: boardLocation(3, 5),
				reason: "activation-output",
			},
		] satisfies ActionVisualEventSchema.Type[];

		expect(shouldSequenceSpawnVisualEvents(events)).toBe(true);
		expect(events.slice(1).map((event) => event.animation?.mode)).toEqual([
			"sequence",
			"sequence",
		]);
		expect(events.slice(1).map((event) => event.animation?.delayMs)).toEqual([
			0,
			spawnSequenceDelayMs,
		]);
	});

	it("sequences exhaust spawn batches with a visible stagger", () => {
		const events = [
			{
				type: "activation.activated",
				itemInstanceId: "stash",
				mode: "exhaust",
			},
			{
				type: "item.spawned",
				animation: ActionVisualAnimation.sequenceFadeIn({
					cause: "stash",
					groupId: "activation:stash:exhaust",
					sequenceIndex: 0,
				}),
				itemInstanceId: "spawned-a",
				itemId: "item:twig",
				originItemInstanceId: "stash",
				to: boardLocation(3, 3),
				reason: "activation-output",
			},
			{
				type: "item.spawned",
				animation: ActionVisualAnimation.sequenceFadeIn({
					cause: "stash",
					groupId: "activation:stash:exhaust",
					sequenceIndex: 1,
				}),
				itemInstanceId: "spawned-b",
				itemId: "item:pebble",
				originItemInstanceId: "stash",
				to: boardLocation(3, 5),
				reason: "activation-output",
			},
		] satisfies ActionVisualEventSchema.Type[];

		expect(shouldSequenceSpawnVisualEvents(events)).toBe(true);
		expect(spawnSequenceDelayMs).toBeGreaterThanOrEqual(100);
		expect(events.slice(1).map((event) => event.animation?.delayMs)).toEqual([
			0,
			spawnSequenceDelayMs,
		]);
	});

	it("clears render delay after a sequence event is already scheduled", () => {
		const event = {
			type: "item.spawned",
			animation: ActionVisualAnimation.sequenceFadeIn({
				cause: "producer",
				groupId: "activation:producer:single",
				sequenceIndex: 2,
			}),
			itemInstanceId: "spawned-c",
			itemId: "item:twig",
			originItemInstanceId: "producer",
			to: boardLocation(3, 6),
			reason: "activation-output",
		} satisfies ActionVisualEventSchema.Type;

		const immediate = toImmediateSequencedVisualEvent(event);

		expect(immediate.animation).toMatchObject({
			delayMs: 0,
			mode: "sequence",
			sequenceIndex: 2,
		});
		expect(event.animation?.delayMs).toBe(spawnSequenceDelayMs * 2);
	});

	it("delays stash depletion until the sequenced output batch finishes", () => {
		const groupId = "activation:stash:exhaust";
		const events = [
			{
				type: "activation.activated",
				itemInstanceId: "stash",
				mode: "exhaust",
			},
			{
				type: "item.spawned",
				animation: ActionVisualAnimation.sequenceFadeIn({
					cause: "stash",
					groupId,
					sequenceIndex: 0,
				}),
				itemInstanceId: "spawned-a",
				itemId: "item:twig",
				originItemInstanceId: "stash",
				to: boardLocation(3, 3),
				reason: "activation-output",
			},
			{
				type: "item.spawned",
				animation: ActionVisualAnimation.sequenceFadeIn({
					cause: "stash",
					groupId,
					sequenceIndex: 1,
				}),
				itemInstanceId: "spawned-b",
				itemId: "item:pebble",
				originItemInstanceId: "stash",
				to: boardLocation(3, 5),
				reason: "activation-output",
			},
			{
				type: "activation.depleted",
				animation: ActionVisualAnimation.state({
					cause: "stash",
					groupId,
				}),
				itemInstanceId: "stash",
				depletion: {
					kind: "remove",
				},
			},
		] satisfies ActionVisualEventSchema.Type[];

		expect(shouldSequenceSpawnVisualEvents(events)).toBe(true);
		expect(sequenceCompletionDelayMs(events)).toBe(
			spawnSequenceDelayMs + (events[2].animation?.durationMs ?? 0),
		);
	});

	it("does not infer sequencing from exhaust without explicit sequence animation metadata", () => {
		const events = [
			{
				type: "activation.activated",
				itemInstanceId: "stash",
				mode: "exhaust",
			},
			{
				type: "item.spawned",
				animation: ActionVisualAnimation.instantFadeIn({
					cause: "stash",
					groupId: "activation:stash:exhaust",
				}),
				itemInstanceId: "spawned-a",
				itemId: "item:twig",
				originItemInstanceId: "stash",
				to: boardLocation(3, 3),
				reason: "activation-output",
			},
		] satisfies ActionVisualEventSchema.Type[];

		expect(shouldSequenceSpawnVisualEvents(events)).toBe(false);
	});
});
