import { describe } from "vitest";
import {
	GameConfigSchema,
	expect,
	it,
	lineRunTestConfig,
	readLines,
	type RuntimeSchema,
} from "./readItemDetailLinesFx.test/fixture";

const workshop = lineRunTestConfig.items.workshop;
if (workshop.type !== "producer") throw new Error("Expected a producer fixture.");

const createDepositConfig = (inputCount: number) =>
	GameConfigSchema.parse({
		...lineRunTestConfig,
		items: {
			...lineRunTestConfig.items,
			workshop: {
				...workshop,
				lines: [
					{
						...workshop.lines[0],
						id: "line:deposit",
						title: "Deposit",
						description: "Consumes nearby charges.",
						show: true,
						enable: true,
						input: Array.from(
							{
								length: inputCount,
							},
							() => ({
								charges: {
									cost: 1,
									from: "target" as const,
								},
								query: {
									distance: "close" as const,
									scope: "board" as const,
									selector: {
										itemId: "tree",
										type: "item" as const,
									},
								},
								type: "deposit" as const,
							}),
						),
						rules: [],
					},
				],
			},
			tree: {
				...lineRunTestConfig.items.water,
				uid: "tree",
				id: "tree",
				title: "Tree",
				description: "Charged deposit.",
				charges: {
					amount: 18,
				},
			},
		},
	});

const createRuntime = (
	config: GameConfigSchema.Type,
	trees: ReadonlyArray<{
		readonly id: string;
		readonly x: number;
		readonly y: number;
		readonly remainingCharges?: number;
	}>,
): RuntimeSchema.Type => ({
	cheats: {
		enabled: false,
		everEnabled: false,
		instantGameplay: false,
	},
	currentSpace: 0,
	items: [
		{
			id: "runtime:workshop",
			item: config.items.workshop!,
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 1,
					y: 1,
				},
			},
			quantity: 1,
			revision: "revision:workshop",
		},
		...trees.map(({ id, remainingCharges, x, y }) => ({
			id,
			item: config.items.tree!,
			location: {
				scope: "board" as const,
				space: 0,
				position: {
					x,
					y,
				},
			},
			quantity: 1,
			...(remainingCharges === undefined
				? {}
				: {
						remainingCharges,
					}),
			revision: `revision:${id}`,
		})),
	],
	jobs: [],
	jobQueue: [],
	defaultLineByOwnerItemId: {},
});

describe("readItemDetailLinesFx / deposits", () => {
	it("sums charges of eligible nearby deposits", () => {
		const config = createDepositConfig(1);
		const lines = readLines(
			createRuntime(config, [
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
		const missing = readLines(createRuntime(config, []), "runtime:workshop", config);
		const depleted = readLines(
			createRuntime(config, [
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
});
