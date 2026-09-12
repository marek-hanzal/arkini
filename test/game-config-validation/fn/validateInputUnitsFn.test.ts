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
		scope: "board" as const,
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

const exactUnitsInput = (itemId: string, cost = 1) => ({
	type: "units" as const,
	query: {
		scope: "board" as const,
		distance: "close" as const,
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

const selfUnitsInput = (itemId: string, cost = 1) => ({
	type: "units" as const,
	query: {
		scope: "board" as const,
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
						scope: "board",
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
			type: "space" as const,
			space: 1,
			units: {
				amount: 2,
			},
			input: [
				{
					type: "simple" as const,
					units: {
						from: "self" as const,
						cost: 2,
					},
				},
			],
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
					selector: {
						type: "item",
						itemId: "material",
					},
					quantity: {
						min: 1,
						max: 1,
					},
					mode: "consume",
					capacity: 0,
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
							scope: "board" as const,
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
			type: "space" as const,
			space: 1,
			units: {
				amount: 2,
			},
			input: [
				unitsInput("payer", {
					from: "self",
				}),
			],
		};
		const payer = {
			...createSimpleItem("payer"),
			scope: "board" as const,
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

	it("rejects an exact inventory-only external payer", async () => {
		const producer = createProducerItem({
			id: "exact-inventory-target",
			input: [
				exactUnitsInput("inventory-target"),
			],
		});
		const target = {
			...createSimpleItem("inventory-target"),
			scope: "inventory" as const,
			units: {
				amount: 1,
			},
		};

		expect(
			await unitDiagnostics({
				[producer.id]: producer,
				[target.id]: target,
			}),
		).toEqual([
			expect.objectContaining({
				reason: InvalidInputUnitsReasonEnumSchema.enum.TargetUnavailable,
			}),
		]);
	});

	it("rejects a selector that matches only inventory-only item with units", async () => {
		const producer = createProducerItem({
			id: "inventory-selector-target",
			input: [
				unitsInput("inventory-source"),
			],
		});
		const target = {
			...createSimpleItem("inventory-source"),
			scope: "inventory" as const,
			units: {
				amount: 1,
			},
		};

		expect(
			await unitDiagnostics({
				[producer.id]: producer,
				[target.id]: target,
			}),
		).toEqual([
			expect.objectContaining({
				reason: InvalidInputUnitsReasonEnumSchema.enum.TargetUnavailable,
			}),
		]);
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
			scope: "board" as const,
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
			scope: "board" as const,
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

	it("rejects aggregate exact-target costs above finite authored unit supply", async () => {
		const producer = createProducerItem({
			id: "aggregate-target",
			input: [
				exactUnitsInput("payer"),
				exactUnitsInput("payer"),
			],
		});
		const payer = {
			...createSimpleItem("payer"),
			scope: "board" as const,
			units: {
				amount: 1,
			},
			maxCount: 1,
		};

		expect(
			await unitDiagnostics({
				[producer.id]: producer,
				[payer.id]: payer,
			}),
		).toEqual([
			expect.objectContaining({
				inputIndex: 1,
				reason: InvalidInputUnitsReasonEnumSchema.enum.TargetInsufficientTotalUnits,
			}),
		]);
	});

	it("accepts aggregate exact-target costs within finite or unknown authored supply", async () => {
		const producer = createProducerItem({
			id: "aggregate-target-valid",
			input: [
				exactUnitsInput("payer"),
				exactUnitsInput("payer"),
			],
		});
		const finitePayer = {
			...createSimpleItem("payer"),
			scope: "board" as const,
			units: {
				amount: 1,
			},
			maxCount: 2,
		};
		const unboundedPayer = {
			...finitePayer,
			maxCount: undefined,
		};

		expect(
			await unitDiagnostics({
				[producer.id]: producer,
				[finitePayer.id]: finitePayer,
			}),
		).toEqual([]);
		expect(
			await unitDiagnostics({
				[producer.id]: producer,
				[unboundedPayer.id]: unboundedPayer,
			}),
		).toEqual([]);
	});

	it("accounts for independent exact target payers separately", async () => {
		const producer = createProducerItem({
			id: "independent-targets",
			input: [
				exactUnitsInput("payer:a"),
				exactUnitsInput("payer:b"),
			],
		});
		const payer = (id: string) => ({
			...createSimpleItem(id),
			scope: "board" as const,
			units: {
				amount: 1,
			},
			maxCount: 1,
		});
		const first = payer("payer:a");
		const second = payer("payer:b");

		expect(
			await unitDiagnostics({
				[producer.id]: producer,
				[first.id]: first,
				[second.id]: second,
			}),
		).toEqual([]);
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
