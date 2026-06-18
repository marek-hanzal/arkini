import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createInitialGameSaveFx } from "~/v0/game/engine/fx/createInitialGameSaveFx";
import {
	blockedScheduledEventRetryDelayMs,
	processScheduledGameEventsFx,
} from "~/v0/game/engine/fx/processScheduledGameEventsFx";
import { scheduleBoardItemRemoveFx } from "~/v0/game/engine/fx/scheduleBoardItemRemoveFx";
import { scheduleGameItemSpawnsFx } from "~/v0/game/engine/fx/scheduleGameItemSpawnsFx";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";

const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));
const runScheduled = (props: processScheduledGameEventsFx.Props) =>
	Effect.runSync(processScheduledGameEventsFx(props));
const runScheduleItems = (props: scheduleGameItemSpawnsFx.Props) =>
	Effect.runSync(scheduleGameItemSpawnsFx(props));
const runScheduleRemove = (props: scheduleBoardItemRemoveFx.Props) =>
	Effect.runSync(scheduleBoardItemRemoveFx(props));

describe("processScheduledGameEventsFx", () => {
	it("emits every due non-exclusive scheduled spawn in one tick", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		runScheduleItems({
			dueAtMs: 100,
			items: [
				{
					itemId: "item:twig",
					quantity: 2,
					reason: "debug",
				},
			],
			save,
		});

		const result = runScheduled({
			config,
			nowMs: 250,
			save,
		});

		expect(result.events).toHaveLength(2);
		expect(result.events.map((event) => event.type)).toEqual([
			"item.created",
			"item.created",
		]);
		expect(result.save.scheduledEvents).toEqual({});
	});

	it("emits at most one due event per exclusive key in one tick", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		runScheduleItems({
			dueAtMs: 100,
			exclusiveKey: "spawn-group:stash-1",
			intervalMs: 100,
			items: [
				{
					itemId: "item:twig",
					quantity: 3,
					reason: "debug",
				},
			],
			save,
		});

		const lateTick = runScheduled({
			config,
			nowMs: 1000,
			save,
		});

		expect(lateTick.events).toHaveLength(1);
		expect(lateTick.events[0]).toMatchObject({
			itemId: "item:twig",
			type: "item.created",
		});
		expect(Object.values(lateTick.save.scheduledEvents)).toHaveLength(2);

		const nextTick = runScheduled({
			config,
			nowMs: 1001,
			save: lateTick.save,
		});

		expect(nextTick.events).toHaveLength(1);
		expect(Object.values(nextTick.save.scheduledEvents)).toHaveLength(1);
	});

	it("keeps blocked scheduled spawns pending", () => {
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 1,
				},
				board: {
					height: 1,
					width: 1,
				},
				title: "Test",
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 3,
		};
		runScheduleItems({
			dueAtMs: 100,
			items: [
				{
					itemId: "item:twig",
					quantity: 1,
					reason: "debug",
				},
			],
			save,
		});

		const result = runScheduled({
			config,
			nowMs: 100,
			save,
		});

		expect(result.events).toEqual([
			{
				blockedAtMs: 100,
				itemId: "item:twig",
				reason: "placement_unavailable",
				scheduledEventId: "scheduled-event:1",
				type: "item.spawn.blocked",
			},
		]);
		expect(result.save.scheduledEvents["scheduled-event:1"]).toMatchObject({
			dueAtMs: 100 + blockedScheduledEventRetryDelayMs,
			lastBlockedAtMs: 100,
		});
	});
	it("does not spam the same blocked scheduled spawn on every retry tick", () => {
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 1,
				},
				board: {
					height: 1,
					width: 1,
				},
				title: "Test",
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 3,
		};
		runScheduleItems({
			dueAtMs: 100,
			items: [
				{
					itemId: "item:twig",
					quantity: 1,
					reason: "debug",
				},
			],
			save,
		});

		const first = runScheduled({
			config,
			nowMs: 100,
			save,
		});
		const second = runScheduled({
			config,
			nowMs: 100 + blockedScheduledEventRetryDelayMs,
			save: first.save,
		});

		expect(first.events).toHaveLength(1);
		expect(second.events).toEqual([]);
		expect(second.save.scheduledEvents["scheduled-event:1"]).toMatchObject({
			dueAtMs: 100 + blockedScheduledEventRetryDelayMs * 2,
			lastBlockedAtMs: 100 + blockedScheduledEventRetryDelayMs,
		});
	});

	it("waits with dependent source removal until exclusive spawns are processed", () => {
		const config = createEngineTestConfig({
			startingState: {
				board: [
					{
						itemId: "item:stash",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const scheduledSpawns = runScheduleItems({
			dueAtMs: 100,
			exclusiveKey: "spawn-group:stash-1",
			intervalMs: 100,
			items: [
				{
					itemId: "item:twig",
					quantity: 2,
					reason: "stash-output",
				},
			],
			save,
		});
		runScheduleRemove({
			afterEventIds: scheduledSpawns.eventIds,
			dueAtMs: scheduledSpawns.lastDueAtMs,
			itemId: "item:stash",
			itemInstanceId: "item-instance:1",
			reason: "stash-depleted",
			save,
		});

		const lateTick = runScheduled({
			config,
			nowMs: 1000,
			save,
		});

		expect(lateTick.events.map((event) => event.type)).toEqual([
			"item.created",
		]);
		expect(lateTick.save.board.items["item-instance:1"]).toMatchObject({
			itemId: "item:stash",
		});
		expect(Object.values(lateTick.save.scheduledEvents)).toHaveLength(2);

		const nextTick = runScheduled({
			config,
			nowMs: 1001,
			save: lateTick.save,
		});

		expect(nextTick.events.map((event) => event.type)).toEqual([
			"item.created",
			"item.removed",
		]);
		expect(nextTick.save.board.items).not.toHaveProperty("item-instance:1");
		expect(nextTick.save.scheduledEvents).toEqual({});
	});
});
