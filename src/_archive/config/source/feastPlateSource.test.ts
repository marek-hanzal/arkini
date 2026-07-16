import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));

describe("feast plate source config", () => {
	it("moves Cookhouse I blueprint vending into Town Hall II", () => {
		const townHall2 = readJson("game/arkini/era-II/producers/townhall-t2.json");
		const townHall2Lines = townHall2.items["producer:townhall-t2"].producer.lines;
		const townHall3 = readJson("game/arkini/era-III/producers/townhall-t3.json");
		const townHall3Lines = townHall3.items["producer:townhall-t3"].producer.lines;

		expect(
			townHall2Lines.some(
				(line: { id: string }) => line.id === "line:townhall-t2:blueprint-cookhouse-t1",
			),
		).toBe(true);
		expect(
			townHall3Lines.some(
				(line: { id: string }) => line.id === "line:townhall-t3:blueprint-cookhouse-t1",
			),
		).toBe(false);
	});

	it("keeps direct feast production out of Town Hall II", () => {
		const townHall = readJson("game/arkini/era-II/producers/townhall-t2.json");
		const lines = townHall.items["producer:townhall-t2"].producer.lines;

		expect(lines.some((line: { id: string }) => line.id === "line:townhall-t2:feast")).toBe(
			false,
		);
	});

	it("removes empty plate production from Tavern I", () => {
		const tavern = readJson("game/arkini/era-III/producers/tavern-t1.json");
		const lines = tavern.items["producer:tavern-t1"].producer.lines;

		expect(lines.some((line: { id: string }) => line.id === "line:tavern-t1:feast-plate")).toBe(
			false,
		);
	});

	it("lets Cookhouse I offer manual plates and slow automatic feast cooking", () => {
		const cookhouse = readJson("game/arkini/era-II/producers/cookhouse-t1.json");
		const lines = cookhouse.items["producer:cookhouse-t1"].producer.lines;
		const plateLine = lines.find(
			(line: { id: string }) => line.id === "line:cookhouse-t1:feast-plate",
		);
		const autoLine = lines.find(
			(line: { id: string }) => line.id === "line:cookhouse-t1:feast",
		);

		expect(cookhouse.items["producer:cookhouse-t1"].tags).toContain("era:II");
		expect(plateLine).toMatchObject({
			durationMs: 8000,
			name: "Feast Plate",
			output: [
				{
					entries: [
						{
							itemId: "item:feast-plate",
							type: "guaranteed",
						},
					],
				},
			],
		});
		expect(autoLine).toMatchObject({
			durationMs: 60000,
			name: "Auto-Cooked Feast",
			output: [
				{
					entries: [
						{
							itemId: "item:feast",
							type: "guaranteed",
						},
					],
				},
			],
		});
	});

	it("defines Feast Plate as a staged craft that finishes into Feast", () => {
		const feastPlate = readJson("game/arkini/era-II/items/feast-plate.json").items[
			"item:feast-plate"
		];

		expect(feastPlate.assetIds).toEqual([
			"asset:item:feast-plate",
			"asset:item:feast-plate-stage-1",
			"asset:item:feast-plate-stage-2",
			"asset:item:feast",
		]);
		expect(feastPlate.tags).toContain("era:II");
		expect(feastPlate.craft).toMatchObject({
			durationMs: 9000,
			output: [
				{
					entries: [
						{
							type: "guaranteed",
							itemId: "item:feast",
						},
					],
				},
			],
			inputs: [
				{
					consume: true,
					itemId: "item:grain",
				},
				{
					consume: true,
					itemId: "item:piglet",
				},
				{
					consume: true,
					itemId: "item:milk",
				},
				{
					consume: true,
					itemId: "item:egg",
				},
				{
					consume: true,
					itemId: "item:vegetables",
				},
			],
		});
	});
});
