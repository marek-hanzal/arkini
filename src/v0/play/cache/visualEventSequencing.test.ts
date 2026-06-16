import { describe, expect, it } from "vitest";
import { ActionVisualAnimation } from "~/v0/play/action/ActionVisualAnimation";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import {
	shouldSequenceSpawnVisualEvents,
	spawnSequenceDelayMs,
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

	it("does not sequence normal producer spawn batches, but still marks them as instant fade-in", () => {
		const events = [
			{
				type: "activation.activated",
				itemInstanceId: "producer",
				mode: "single",
			},
			{
				type: "item.spawned",
				animation: ActionVisualAnimation.instantFadeIn({
					cause: "producer",
					groupId: "activation:producer:single",
				}),
				itemInstanceId: "spawned-a",
				itemId: "item:twig",
				originItemInstanceId: "producer",
				to: boardLocation(3, 3),
				reason: "activation-output",
			},
			{
				type: "item.spawned",
				animation: ActionVisualAnimation.instantFadeIn({
					cause: "producer",
					groupId: "activation:producer:single",
				}),
				itemInstanceId: "spawned-b",
				itemId: "item:branch",
				originItemInstanceId: "producer",
				to: boardLocation(3, 5),
				reason: "activation-output",
			},
		] satisfies ActionVisualEventSchema.Type[];

		expect(shouldSequenceSpawnVisualEvents(events)).toBe(false);
		expect(events.slice(1).map((event) => event.animation?.mode)).toEqual([
			"instant",
			"instant",
		]);
		expect(events.slice(1).map((event) => event.animation?.effect)).toEqual([
			"fade-in",
			"fade-in",
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
