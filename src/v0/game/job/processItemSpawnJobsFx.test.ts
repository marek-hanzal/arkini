import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createInitialGameSaveFx } from "~/v0/game/engine/fx/createInitialGameSaveFx";
import {
	blockedItemSpawnJobRetryDelayMs,
	processItemSpawnJobsFx,
} from "~/v0/game/job/processItemSpawnJobsFx";
import { createItemSpawnJobsFx } from "~/v0/game/job/createItemSpawnJobsFx";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";

const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));
const runItemSpawn = (props: processItemSpawnJobsFx.Props) =>
	Effect.runSync(processItemSpawnJobsFx(props));
const runCreateItemSpawnJobs = (props: createItemSpawnJobsFx.Props) =>
	Effect.runSync(createItemSpawnJobsFx(props));

describe("processItemSpawnJobsFx", () => {
	it("emits every due non-exclusive item spawn job in one tick", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		runCreateItemSpawnJobs({
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

		const result = runItemSpawn({
			config,
			nowMs: 250,
			save,
		});

		expect(result.events).toHaveLength(2);
		expect(result.events.map((event) => event.type)).toEqual([
			"item.created",
			"item.created",
		]);
		expect(result.save.itemSpawnJobs).toEqual({});
	});

	it("emits at most one due job per exclusive key in one tick", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		runCreateItemSpawnJobs({
			dueAtMs: 100,
			exclusiveGroupKey: "spawn-group:stash-1",
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

		const lateTick = runItemSpawn({
			config,
			nowMs: 1000,
			save,
		});

		expect(lateTick.events).toHaveLength(1);
		expect(lateTick.events[0]).toMatchObject({
			itemId: "item:twig",
			type: "item.created",
		});
		expect(Object.values(lateTick.save.itemSpawnJobs)).toHaveLength(2);

		const nextTick = runItemSpawn({
			config,
			nowMs: 1001,
			save: lateTick.save,
		});

		expect(nextTick.events).toHaveLength(1);
		expect(Object.values(nextTick.save.itemSpawnJobs)).toHaveLength(1);
	});

	it("keeps blocked item spawn jobs pending", () => {
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
		const itemSpawn = runCreateItemSpawnJobs({
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
		const [jobId] = itemSpawn.jobIds;

		const result = runItemSpawn({
			config,
			nowMs: 100,
			save,
		});

		expect(result.events).toEqual([
			{
				blockedAtMs: 100,
				itemId: "item:twig",
				reason: "board:full",
				jobId,
				type: "item.spawn.blocked",
			},
		]);
		expect(result.save.itemSpawnJobs[jobId]).toMatchObject({
			dueAtMs: 100 + blockedItemSpawnJobRetryDelayMs,
			lastBlockedAtMs: 100,
		});
	});
	it("does not spam the same blocked item spawn job on every retry tick", () => {
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
		const itemSpawn = runCreateItemSpawnJobs({
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
		const [jobId] = itemSpawn.jobIds;

		const first = runItemSpawn({
			config,
			nowMs: 100,
			save,
		});
		const second = runItemSpawn({
			config,
			nowMs: 100 + blockedItemSpawnJobRetryDelayMs,
			save: first.save,
		});

		expect(first.events).toHaveLength(1);
		expect(second.events).toEqual([]);
		expect(second.save.itemSpawnJobs[jobId]).toMatchObject({
			dueAtMs: 100 + blockedItemSpawnJobRetryDelayMs * 2,
			lastBlockedAtMs: 100 + blockedItemSpawnJobRetryDelayMs,
		});
	});

	it("waits with dependent item spawn jobs until source jobs are processed", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const itemSpawn = runCreateItemSpawnJobs({
			dueAtMs: 100,
			exclusiveGroupKey: "spawn-group:test",
			items: [
				{
					itemId: "item:twig",
					quantity: 1,
					reason: "debug",
				},
			],
			save,
		});
		const [sourceJobId] = itemSpawn.jobIds;
		const dependentJobId = "item-spawn-job:dependent";
		save.itemSpawnJobs[dependentJobId] = {
			afterJobIds: [
				sourceJobId,
			],
			dueAtMs: 100,
			exclusiveGroupKey: "spawn-group:test",
			id: dependentJobId,
			itemId: "item:plank",
			quantity: 1,
			reason: "debug",
			type: "item.spawn",
		};

		const lateTick = runItemSpawn({
			config,
			nowMs: 1000,
			save,
		});

		expect(lateTick.events.map((event) => event.type)).toEqual([
			"item.created",
		]);
		expect(Object.values(lateTick.save.itemSpawnJobs)).toHaveLength(1);

		const nextTick = runItemSpawn({
			config,
			nowMs: 1001,
			save: lateTick.save,
		});

		expect(nextTick.events.map((event) => event.type)).toEqual([
			"item.created",
		]);
		expect(nextTick.events[0]).toMatchObject({
			itemId: "item:plank",
		});
		expect(nextTick.save.itemSpawnJobs).toEqual({});
	});
});
