import { describe } from "vitest";
import {
	GameConfigSchema,
	expect,
	it,
	lineRunRuntime,
	lineRunTestConfig,
	readLines,
} from "../support/readItemDetailLinesFxFixture";

describe("readItemDetailLinesFx / autofill availability", () => {
	it("reports material quantity available to autofill and a direct producer fallback", () => {
		const boardWater = {
			id: "runtime:water:board",
			item: lineRunTestConfig.items.water,
			location: {
				scope: "board" as const,
				space: 0,
				position: {
					x: 2,
					y: 0,
				},
			},
			quantity: 4,
			revision: "revision:water:board",
		};
		const toolbarWater = {
			...boardWater,
			id: "runtime:water:toolbar",
			location: {
				scope: "toolbar" as const,
				position: {
					x: 0,
					y: 0,
				},
			},
			quantity: 3,
			revision: "revision:water:toolbar",
		};
		const inventoryWater = {
			...boardWater,
			id: "runtime:water:inventory",
			location: {
				scope: "inventory" as const,
				position: {
					x: 0,
					y: 0,
				},
			},
			quantity: 2,
			revision: "revision:water:inventory",
		};
		const available = readLines({
			...lineRunRuntime({
				permit: true,
			}),
			items: [
				...lineRunRuntime({
					permit: true,
				}).items,
				boardWater,
				toolbarWater,
				inventoryWater,
			],
		});
		if (available.kind !== "available") throw new Error("Expected available lines.");
		expect(available.line[0]?.input[0]).toMatchObject({
			kind: "materials",
			autofillAvailableQuantity: 9,
		});
		expect(available.line[0]?.input[0]).not.toHaveProperty("producerItemId");

		const producerConfig = GameConfigSchema.parse({
			...lineRunTestConfig,
			items: {
				...lineRunTestConfig.items,
				pump: {
					...lineRunTestConfig.items.workshop,
					uid: "pump",
					id: "pump",
					title: "Pump",
					description: "Produces water.",
					lines: [
						{
							id: "line:pump:water",
							title: "Pump Water",
							description: "Produces water.",
							show: true,
							enable: true,
							runtimeMs: 1_000,
							input: [
								{
									type: "simple",
								},
							],
							output: {
								set: [
									{
										roll: [
											{
												type: "guaranteed",
												drop: [
													{
														itemId: "water",
														quantity: {
															min: 1,
															max: 1,
														},
														rules: [],
													},
												],
											},
										],
									},
								],
							},
							rules: [],
						},
					],
				},
			},
		});
		const baseRuntime = lineRunRuntime({
			permit: true,
		});
		const producerItem = {
			id: "runtime:pump",
			item: producerConfig.items.pump,
			location: {
				scope: "board" as const,
				space: 0,
				position: {
					x: 3,
					y: 0,
				},
			},
			quantity: 1,
			revision: "revision:pump",
		};
		const fallback = readLines(
			{
				...baseRuntime,
				items: [
					...baseRuntime.items,
					producerItem,
				],
			},
			"runtime:workshop",
			producerConfig,
		);
		if (fallback.kind !== "available") throw new Error("Expected available lines.");
		expect(fallback.line[0]?.input[0]).toMatchObject({
			kind: "materials",
			autofillAvailableQuantity: 0,
			producerItemId: "runtime:pump",
		});
	});
});
