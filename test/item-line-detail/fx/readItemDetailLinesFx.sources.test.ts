import { describe } from "vitest";
import {
	createUnitsConfig,
	createUnitsRuntime,
	expect,
	it,
	readLines,
	type RuntimeSchema,
} from "../support/readItemDetailLinesFxFixture";

describe("readItemDetailLinesFx / unit sources", () => {
	it("sums units of eligible nearby unit sources", () => {
		const config = createUnitsConfig(1);
		const lines = readLines(
			createUnitsRuntime(config, [
				{
					id: "runtime:tree:full",
					x: 1,
					y: 0,
				},
				{
					id: "runtime:tree:five",
					x: 0,
					y: 1,
					remainingUnits: 5,
				},
				{
					id: "runtime:tree:ten",
					x: 2,
					y: 1,
					remainingUnits: 10,
				},
				{
					id: "runtime:tree:far",
					x: 4,
					y: 0,
					remainingUnits: 7,
				},
			]),
			"runtime:workshop",
			config,
		);

		expect(lines.kind).toBe("available");
		if (lines.kind !== "available") throw new Error("Expected available lines.");
		expect(lines.line[0]?.input[0]).toMatchObject({
			kind: "units",
			requiredUnits: 1,
			availableUnits: 33,
			ready: true,
		});
	});

	it("distinguishes a missing target from insufficient units", () => {
		const config = createUnitsConfig(2);
		const missing = readLines(createUnitsRuntime(config, []), "runtime:workshop", config);
		const depleted = readLines(
			createUnitsRuntime(config, [
				{
					id: "runtime:tree",
					x: 1,
					y: 0,
					remainingUnits: 1,
				},
			]),
			"runtime:workshop",
			config,
		);
		if (missing.kind !== "available" || depleted.kind !== "available") {
			throw new Error("Expected units lines.");
		}

		expect(missing.line[0]).toMatchObject({
			availability: {
				kind: "unavailable",
				reason: {
					kind: "units-target-missing",
				},
			},
			input: [
				{
					kind: "units",
					availableUnits: 0,
					requiredUnits: 2,
					targetItemIds: [],
					ready: false,
				},
			],
		});
		expect(depleted.line[0]).toMatchObject({
			availability: {
				kind: "available",
				readiness: "inputs",
			},
			input: [
				{
					kind: "units",
					availableUnits: 1,
					requiredUnits: 2,
					targetItemIds: [
						"runtime:tree",
					],
					ready: false,
				},
			],
		});
	});

	it("projects stored units owners without inventing a board origin", () => {
		const config = createUnitsConfig(1);
		const boardRuntime = createUnitsRuntime(config, [
			{
				id: "runtime:tree",
				x: 1,
				y: 0,
			},
		]);
		const storedRuntime = {
			...boardRuntime,
			items: boardRuntime.items.map((item) =>
				item.id === "runtime:workshop"
					? {
							...item,
							location: {
								scope: "inventory" as const,
								position: {
									x: 0,
									y: 0,
								},
							},
						}
					: item,
			),
		} satisfies RuntimeSchema.Type;

		const lines = readLines(storedRuntime, "runtime:workshop", config);
		expect(lines).toMatchObject({
			kind: "available",
			line: [
				{
					availability: {
						kind: "unavailable",
						reason: {
							kind: "owner-stored",
						},
					},
					input: [
						{
							kind: "units",
							availableUnits: 0,
							targetItemIds: [],
						},
					],
				},
			],
		});
	});
});
