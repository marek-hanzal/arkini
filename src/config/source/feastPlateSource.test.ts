import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));

describe("feast plate source config", () => {
	it("removes direct feast production from Town Hall II", () => {
		const townHall = readJson("game/arkini/era-II/producers/townhall-t2.json");
		const lines = townHall.items["producer:townhall-t2"].producer.lines;

		expect(lines.some((line: { id: string }) => line.id === "line:townhall-t2:feast")).toBe(
			false,
		);
	});

	it("lets Tavern I serve feast plates", () => {
		const tavern = readJson("game/arkini/era-III/producers/tavern-t1.json");
		const feastPlateLine = tavern.items["producer:tavern-t1"].producer.lines.find(
			(line: { id: string }) => line.id === "line:tavern-t1:feast-plate",
		);

		expect(feastPlateLine).toMatchObject({
			durationMs: 8000,
			name: "Feast Plate",
			output: [
				{
					itemId: "item:feast-plate",
					type: "guaranteed",
				},
			],
		});
	});

	it("defines Feast Plate as a staged craft that finishes into Feast", () => {
		const feastPlate = readJson("game/arkini/era-III/items/feast-plate.json").items[
			"item:feast-plate"
		];

		expect(feastPlate.assetIds).toEqual([
			"asset:item:feast-plate",
			"asset:item:feast-plate-stage-1",
			"asset:item:feast-plate-stage-2",
			"asset:item:feast",
		]);
		expect(feastPlate.craft).toMatchObject({
			durationMs: 9000,
			resultItemId: "item:feast",
			inputs: [
				{
					consume: true,
					itemId: "item:bread",
				},
				{
					consume: true,
					itemId: "item:sausage",
				},
				{
					consume: true,
					itemId: "item:cheese",
				},
				{
					consume: true,
					itemId: "item:vegetables",
				},
				{
					consume: true,
					itemId: "item:egg",
				},
			],
		});
	});
});
