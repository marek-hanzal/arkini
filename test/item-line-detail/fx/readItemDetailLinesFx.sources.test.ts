import { describe } from "vitest";
import {
	createDepositConfig,
	createDepositRuntime,
	expect,
	it,
	readLines,
	type RuntimeSchema,
} from "../support/readItemDetailLinesFxFixture";

describe("readItemDetailLinesFx / deposits", () => {
	it("sums charges of eligible nearby deposits", () => {
		const config = createDepositConfig(1);
		const lines = readLines(
			createDepositRuntime(config, [
				{
					id: "runtime:tree:full",
					x: 1,
					y: 0,
				},
				{
					id: "runtime:tree:five",
					x: 0,
					y: 1,
					remainingCharges: 5,
				},
				{
					id: "runtime:tree:ten",
					x: 2,
					y: 1,
					remainingCharges: 10,
				},
				{
					id: "runtime:tree:far",
					x: 4,
					y: 0,
					remainingCharges: 7,
				},
			]),
			"runtime:workshop",
			config,
		);

		expect(lines.kind).toBe("available");
		if (lines.kind !== "available") throw new Error("Expected available lines.");
		expect(lines.line[0]?.input[0]).toMatchObject({
			kind: "deposit",
			requiredCharges: 1,
			availableCharges: 33,
			ready: true,
		});
	});

	it("distinguishes a missing target from insufficient charges", () => {
		const config = createDepositConfig(2);
		const missing = readLines(createDepositRuntime(config, []), "runtime:workshop", config);
		const depleted = readLines(
			createDepositRuntime(config, [
				{
					id: "runtime:tree",
					x: 1,
					y: 0,
					remainingCharges: 1,
				},
			]),
			"runtime:workshop",
			config,
		);
		if (missing.kind !== "available" || depleted.kind !== "available") {
			throw new Error("Expected deposit lines.");
		}

		expect(missing.line[0]).toMatchObject({
			availability: {
				kind: "unavailable",
				reason: {
					kind: "deposit-target-missing",
				},
			},
			input: [
				{
					kind: "deposit",
					availableCharges: 0,
					requiredCharges: 2,
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
					kind: "deposit",
					availableCharges: 1,
					requiredCharges: 2,
					targetItemIds: [
						"runtime:tree",
					],
					ready: false,
				},
			],
		});
	});

	it("projects stored deposit owners without inventing a board origin", () => {
		const config = createDepositConfig(1);
		const boardRuntime = createDepositRuntime(config, [
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
							kind: "deposit",
							availableCharges: 0,
							targetItemIds: [],
						},
					],
				},
			],
		});
	});
});
