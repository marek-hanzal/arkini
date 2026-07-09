import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { createInitialGameSaveFx } from "~/save/createInitialGameSaveFx";
import { readWorldProcessableJobFacts } from "~/world/readWorldProcessableJobFacts";

const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));

describe("readWorldProcessableJobFacts", () => {
	it("reports due world jobs with concrete entities and reasons", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.itemSpawnJobs["spawn:due"] = {
			id: "spawn:due",
			itemId: "item:twig",
			quantity: 1,
			readyAtMs: 50,
			reason: "debug",
			type: "item.spawn",
		};
		save.itemSpawnJobs["spawn:blocked"] = {
			afterJobIds: [
				"spawn:due",
			],
			id: "spawn:blocked",
			itemId: "item:twig",
			quantity: 1,
			readyAtMs: 10,
			reason: "debug",
			type: "item.spawn",
		};
		save.producerJobs["producer:due"] = {
			id: "producer:due",
			itemInstanceId: "item-instance:1",
			lineId: "line:test",
			readyAtMs: 100,
			startAtMs: 0,
		};
		save.craftJobs["craft:due"] = {
			id: "craft:due",
			recipeId: "item:craft-table",
			readyAtMs: 100,
			startAtMs: 0,
			targetItemInstanceId: "item-instance:1",
		};
		save.activeEffects["effect:due"] = {
			effectId: "effect:test",
			endAtMs: 90,
			id: "effect:due",
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 0,
		};

		expect(
			readWorldProcessableJobFacts({
				config,
				nowMs: 100,
				save,
			}).map(({ entity, reason }) => ({
				entity,
				reason,
			})),
		).toEqual([
			{
				entity: {
					id: "spawn:due",
					kind: "itemSpawnJob",
				},
				reason: "item_spawn_ready",
			},
			{
				entity: {
					id: "effect:due",
					kind: "activeEffect",
				},
				reason: "active_effect_end",
			},
			{
				entity: {
					id: "craft:due",
					kind: "craftJob",
				},
				reason: "craft_ready",
			},
			{
				entity: {
					id: "producer:due",
					kind: "producerJob",
				},
				reason: "producer_queue_ready",
			},
		]);
	});
});
