import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));

const questIds = [
	"item:quest:road-repair",
	"item:quest:water-carrier",
	"item:quest:farmers-favor",
	"item:quest:tavern-commission",
] as const;

const questFiles = [
	"game/arkini/era-I/items/quest-road-repair.json",
	"game/arkini/era-I/items/quest-water-carrier.json",
	"game/arkini/era-II/items/quest-farmers-favor.json",
	"game/arkini/era-III/items/quest-tavern-commission.json",
] as const;

describe("quest source config", () => {
	it("defines quests as storable one-tile craft targets", () => {
		for (const file of questFiles) {
			const item = Object.values<any>(readJson(file).items)[0];

			expect(item.assetIds).toEqual([
				"asset:item:quest",
			]);
			expect(item.storage).toBe("both");
			expect(item.maxStackSize).toBe(1);
			expect(item.tags).toContain("quest");
			expect(item.tags).toContain("craft-target");
			expect(item.craft).toBeDefined();
		}
	});

	it("keeps quest rewards away from blueprints and direct input echoes", () => {
		for (const file of questFiles) {
			const item = Object.values<any>(readJson(file).items)[0];
			const inputItemIds = item.craft.inputs.map((input: { itemId: string }) => input.itemId);

			expect(item.craft.resultItemId).not.toMatch(/^item:blueprint-/);
			expect(inputItemIds).not.toContain(item.craft.resultItemId);
		}
	});

	it("spawns quests from multiple producer lines", () => {
		const producerFiles = [
			"game/arkini/era-I/producers/lumberjack-t1.json",
			"game/arkini/era-I/producers/quarry-t1.json",
			"game/arkini/era-I/producers/well-t1.json",
			"game/arkini/era-II/producers/farm-t1.json",
			"game/arkini/era-II/producers/chicken-coop-t1.json",
			"game/arkini/era-III/producers/tavern-t1.json",
		];
		const spawnedQuestIds = new Set<string>();

		for (const file of producerFiles) {
			const item = Object.values<any>(readJson(file).items)[0];
			for (const line of item.producer.lines) {
				for (const output of line.output ?? []) {
					if (questIds.includes(output.itemId)) {
						expect(output.type).toBe("chance");
						expect(output.chance).toBeGreaterThan(0);
						expect(output.chance).toBeLessThanOrEqual(0.05);
						spawnedQuestIds.add(output.itemId);
					}
				}
			}
		}

		expect(
			[
				...spawnedQuestIds,
			].sort(),
		).toEqual(
			[
				...questIds,
			].sort(),
		);
	});
});
