import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/game-config-compiler/fx/compileGameSourcesFx";
import {
	createProducerItem,
	createRootSource,
	createSimpleItem,
	createItemBase,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { InvalidInputUnitsReasonEnumSchema } from "~/game-config-diagnostic/schema/InvalidInputUnitsReasonEnumSchema";

const unitDiagnostics = async (items: Record<string, unknown>) =>
	(
		await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items,
				}),
			]),
		)
	).diagnostics.filter(({ code }) => code === DiagnosticCodeEnumSchema.enum.InputUnitsInvalid);

const unitsInput = (
	itemId: string,
	{
		cost = 1,
		from = "target",
	}: {
		cost?: number;
		from?: "self" | "target";
	} = {},
) => ({
	type: "units" as const,
	query: {
		distance: "close" as const,
		selector: {
			type: "item" as const,
			itemId,
		},
	},
	units: {
		cost,
		from,
	},
});

const selfUnitsInput = (itemId: string, cost = 1) => ({
	type: "units" as const,
	query: {
		distance: "self" as const,
		selector: {
			type: "item" as const,
			itemId,
		},
	},
	units: {
		cost,
		from: "target" as const,
	},
});

describe("validateInputUnitsFn", () => {
	it("accepts self-targeted units on a Producer and rejects the same owner without units", async () => {
		const producer = createProducerItem({
			id: "producer:self",
			input: [
				selfUnitsInput("producer:self"),
			],
		});
		expect(
			await unitDiagnostics({
				[producer.id]: producer,
			}),
		).toEqual([
			expect.objectContaining({
				ownerItemId: producer.id,
				reason: InvalidInputUnitsReasonEnumSchema.enum.TargetUnavailable,
			}),
		]);
		expect(
			await unitDiagnostics({
				[producer.id]: {
					...producer,
					units: {
						amount: 2,
					},
				},
			}),
		).toEqual([]);
	});

	it("requires every units input to author a target unit cost", async () => {
		const producer = createProducerItem({
			id: "producer",
			input: [
				{
					type: "units",
					query: {
						distance: "close",
						selector: {
							type: "item",
							itemId: "source",
						},
					},
				},
			],
		});

		expect(
			await unitDiagnostics({
				[producer.id]: producer,
			}),
		).toEqual([
			expect.objectContaining({
				reason: InvalidInputUnitsReasonEnumSchema.enum.UnitsMissingTargetCost,
			}),
		]);
	});

	it("rejects self unit costs without sufficient owner units", async () => {
		const missing = createProducerItem({
			id: "missing",
			input: [
				{
					type: "simple",
					units: {
						from: "self",
						cost: 1,
					},
				},
			],
		});
		const insufficient = {
			...createProducerItem({
				id: "insufficient",
				input: [
					{
						type: "simple",
						units: {
							from: "self",
							cost: 2,
						},
					},
				],
			}),
			units: {
				amount: 1,
			},
		};

		expect(
			await unitDiagnostics({
				[missing.id]: missing,
				[insufficient.id]: insufficient,
			}),
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					ownerItemId: missing.id,
					reason: InvalidInputUnitsReasonEnumSchema.enum.SelfMissingUnits,
				}),
				expect.objectContaining({
					ownerItemId: insufficient.id,
					reason: InvalidInputUnitsReasonEnumSchema.enum.SelfInsufficientUnits,
				}),
			]),
		);
	});

	it("rejects aggregate self costs above the owner's authored units", async () => {
		const shrine = {
			...createProducerItem({
				id: "aggregate-self",
				input: [
					{
						type: "simple",
						units: {
							from: "self",
							cost: 1,
						},
					},
					{
						type: "simple",
						units: {
							from: "self",
							cost: 1,
						},
					},
				],
			}),
			units: {
				amount: 1,
			},
		};

		expect(
			await unitDiagnostics({
				[shrine.id]: shrine,
			}),
		).toEqual([
			expect.objectContaining({
				inputIndex: 1,
				reason: InvalidInputUnitsReasonEnumSchema.enum.SelfInsufficientUnits,
			}),
		]);
	});

	it("counts only authored Space Action self costs", async () => {
		const portal = {
			...createItemBase("space:cumulative"),

			action: {
				type: "space" as const,
				space: 1,
				input: [
					{
						type: "simple" as const,
						units: {
							from: "self" as const,
							cost: 2,
						},
					},
				],
			},

			units: {
				amount: 2,
			},
		};

		expect(
			await unitDiagnostics({
				[portal.id]: portal,
			}),
		).toEqual([]);
	});

	it("rejects target costs outside units inputs and allows spent Line owners to pay Units costs", async () => {
		const materialTarget = createProducerItem({
			id: "material-target",
			input: [
				{
					type: "materials",
					query: {
						distance: "far" as const,
						selector: {
							type: "item",
							itemId: "material",
						},
					},
					quantity: {
						min: 1,
						max: 1,
					},
					mode: "consume",
					units: {
						from: "target",
						cost: 1,
					},
				},
			],
		});
		const unitsSelf = {
			...createProducerItem({
				id: "units-self",
				input: [
					{
						...unitsInput("units-self", {
							from: "self",
						}),
						query: {
							distance: "self" as const,
							selector: {
								type: "item" as const,
								itemId: "units-self",
							},
						},
					},
				],
			}),
			units: {
				amount: 1,
			},
		};

		expect(
			await unitDiagnostics({
				[materialTarget.id]: materialTarget,
				[unitsSelf.id]: unitsSelf,
				material: createSimpleItem("material"),
			}),
		).toEqual([
			expect.objectContaining({
				reason: InvalidInputUnitsReasonEnumSchema.enum.TargetRequiresUnits,
			}),
		]);
	});

	it("allows a Space units requirement to unit its action owner", async () => {
		const portal = {
			...createItemBase("space:owner-paid"),

			action: {
				type: "space" as const,
				space: 1,
				input: [
					unitsInput("payer", {
						from: "self",
					}),
				],
			},

			units: {
				amount: 2,
			},
		};
		const payer = {
			...createSimpleItem("payer"),
			units: {
				amount: 1,
			},
		};

		expect(
			await unitDiagnostics({
				[portal.id]: portal,
				[payer.id]: payer,
			}),
		).toEqual([]);
	});

	it("accepts board and any external payer scopes", async () => {
		const boardProducer = createProducerItem({
			id: "board-capable-target",
			input: [
				unitsInput("board-source"),
			],
		});
		const anyProducer = createProducerItem({
			id: "any-capable-target",
			input: [
				unitsInput("any-source"),
			],
		});
		const boardTarget = {
			...createSimpleItem("board-source"),
			units: {
				amount: 1,
			},
		};
		const anyTarget = {
			...createSimpleItem("any-source"),
			units: {
				amount: 1,
			},
		};

		expect(
			await unitDiagnostics({
				[boardProducer.id]: boardProducer,
				[boardTarget.id]: boardTarget,
			}),
		).toEqual([]);
		expect(
			await unitDiagnostics({
				[anyProducer.id]: anyProducer,
				[anyTarget.id]: anyTarget,
			}),
		).toEqual([]);
	});

	it("requires a units selector to match at least one sufficiently item with units", async () => {
		const producer = createProducerItem({
			id: "producer",
			input: [
				unitsInput("weak", {
					cost: 2,
				}),
			],
		});
		const weak = {
			...createSimpleItem("weak"),
			units: {
				amount: 1,
			},
		};

		expect(
			await unitDiagnostics({
				[producer.id]: producer,
				[weak.id]: weak,
			}),
		).toEqual([
			expect.objectContaining({
				reason: InvalidInputUnitsReasonEnumSchema.enum.TargetUnavailable,
			}),
		]);
	});

	it("accepts explicit self and target unit payers", async () => {
		const shrine = {
			...createProducerItem({
				id: "shrine",
				input: [
					{
						type: "simple",
						units: {
							from: "self",
							cost: 2,
						},
					},
					unitsInput("target", {
						cost: 2,
					}),
				],
			}),
			units: {
				amount: 3,
			},
		};
		const target = {
			...createSimpleItem("target"),
			units: {
				amount: 2,
			},
		};

		expect(
			await unitDiagnostics({
				[shrine.id]: shrine,
				[target.id]: target,
			}),
		).toEqual([]);
	});
});
