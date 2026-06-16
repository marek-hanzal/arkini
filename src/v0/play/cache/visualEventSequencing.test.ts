import { describe, expect, it } from "vitest";
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
	it("keeps swap events as one immediate batch so both tiles can animate in parallel", () => {
		const events = [
			{
				type: "item.swapped",
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
			sourceTo: boardLocation(4, 4),
			targetTo: boardLocation(2, 4),
		});
	});

	it("does not sequence normal producer spawn batches", () => {
		const events = [
			{
				type: "activation.activated",
				itemInstanceId: "producer",
				mode: "single",
			},
			{
				type: "item.spawned",
				itemInstanceId: "spawned-a",
				itemId: "item:twig",
				originItemInstanceId: "producer",
				to: boardLocation(3, 3),
				reason: "activation-output",
			},
			{
				type: "item.spawned",
				itemInstanceId: "spawned-b",
				itemId: "item:branch",
				originItemInstanceId: "producer",
				to: boardLocation(3, 5),
				reason: "activation-output",
			},
		] satisfies ActionVisualEventSchema.Type[];

		expect(shouldSequenceSpawnVisualEvents(events)).toBe(false);
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
				itemInstanceId: "spawned-a",
				itemId: "item:twig",
				originItemInstanceId: "stash",
				to: boardLocation(3, 3),
				reason: "activation-output",
			},
			{
				type: "item.spawned",
				itemInstanceId: "spawned-b",
				itemId: "item:pebble",
				originItemInstanceId: "stash",
				to: boardLocation(3, 5),
				reason: "activation-output",
			},
		] satisfies ActionVisualEventSchema.Type[];

		expect(shouldSequenceSpawnVisualEvents(events)).toBe(true);
		expect(spawnSequenceDelayMs).toBeGreaterThanOrEqual(100);
	});
});
