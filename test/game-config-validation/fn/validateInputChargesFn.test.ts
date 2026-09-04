import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/game-config-compiler/fx/compileGameSourcesFx";
import {
	createLine,
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { InvalidInputChargesReasonEnumSchema } from "~/game-config-diagnostic/schema/InvalidInputChargesReasonEnumSchema";

const chargeDiagnostics = async (items: Record<string, unknown>) =>
	(
		await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items,
				}),
			]),
		)
	).diagnostics.filter(({ code }) => code === DiagnosticCodeEnumSchema.enum.InputChargesInvalid);

const depositInput = (
	itemId: string,
	{
		cost = 1,
		from = "target",
	}: {
		cost?: number;
		from?: "self" | "target";
	} = {},
) => ({
	type: "deposit" as const,
	query: {
		scope: "board" as const,
		distance: "close" as const,
		selector: {
			type: "item" as const,
			itemId,
		},
	},
	charges: {
		cost,
		from,
	},
});

const exactDepositInput = (itemId: string, cost = 1) => ({
	type: "deposit" as const,
	query: {
		scope: "board" as const,
		distance: "close" as const,
		selector: {
			type: "item" as const,
			itemId,
		},
	},
	charges: {
		cost,
		from: "target" as const,
	},
});

const selfDepositInput = (itemId: string, cost = 1) => ({
	type: "deposit" as const,
	query: {
		scope: "board" as const,
		distance: "self" as const,
		selector: {
			type: "item" as const,
			itemId,
		},
	},
	charges: {
		cost,
		from: "target" as const,
	},
});

describe("validateInputChargesFn", () => {
	it("allows self distance only for a deposit line owner", async () => {
		const producer = createProducerItem({
			id: "producer:self",
			input: [
				selfDepositInput("producer:self"),
			],
		});
		const deposit = {
			...createSimpleItem("deposit:self"),
			type: "deposit" as const,
			charges: {
				amount: 2,
			},
			lines: [
				createLine({
					input: [
						selfDepositInput("deposit:self"),
					],
				}),
			],
		};

		expect(
			await chargeDiagnostics({
				[producer.id]: producer,
			}),
		).toEqual([
			expect.objectContaining({
				ownerItemId: producer.id,
				reason: InvalidInputChargesReasonEnumSchema.enum.DepositSelfRequiresDepositOwner,
			}),
		]);
		expect(
			await chargeDiagnostics({
				[deposit.id]: deposit,
			}),
		).toEqual([]);
	});

	it("requires every deposit input to author a target charge cost", async () => {
		const producer = createProducerItem({
			id: "producer",
			input: [
				{
					type: "deposit",
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
			await chargeDiagnostics({
				[producer.id]: producer,
			}),
		).toEqual([
			expect.objectContaining({
				reason: InvalidInputChargesReasonEnumSchema.enum.DepositMissingTargetCost,
			}),
		]);
	});

	it("rejects self charge costs without sufficient owner charges", async () => {
		const missing = createProducerItem({
			id: "missing",
			input: [
				{
					type: "simple",
					charges: {
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
						charges: {
							from: "self",
							cost: 2,
						},
					},
				],
			}),
			charges: {
				amount: 1,
			},
		};

		expect(
			await chargeDiagnostics({
				[missing.id]: missing,
				[insufficient.id]: insufficient,
			}),
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					ownerItemId: missing.id,
					reason: InvalidInputChargesReasonEnumSchema.enum.SelfMissingCharges,
				}),
				expect.objectContaining({
					ownerItemId: insufficient.id,
					reason: InvalidInputChargesReasonEnumSchema.enum.SelfInsufficientCharges,
				}),
			]),
		);
	});

	it("rejects aggregate self costs above the owner's authored charges", async () => {
		const shrine = {
			...createProducerItem({
				id: "aggregate-self",
				input: [
					{
						type: "simple",
						charges: {
							from: "self",
							cost: 1,
						},
					},
					{
						type: "simple",
						charges: {
							from: "self",
							cost: 1,
						},
					},
				],
			}),
			charges: {
				amount: 1,
			},
		};

		expect(
			await chargeDiagnostics({
				[shrine.id]: shrine,
			}),
		).toEqual([
			expect.objectContaining({
				inputIndex: 1,
				reason: InvalidInputChargesReasonEnumSchema.enum.SelfInsufficientCharges,
			}),
		]);
	});

	it("counts only authored Space Action self costs", async () => {
		const portal = {
			...createSimpleItem("space:cumulative"),
			type: "space" as const,
			space: 1,
			charges: {
				amount: 2,
			},
			input: [
				{
					type: "simple" as const,
					charges: {
						from: "self" as const,
						cost: 2,
					},
				},
			],
		};

		expect(
			await chargeDiagnostics({
				[portal.id]: portal,
			}),
		).toEqual([]);
	});

	it("rejects target costs outside deposit inputs and allows charged Line owners to pay Deposit costs", async () => {
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
					charges: {
						from: "target",
						cost: 1,
					},
				},
			],
		});
		const depositSelf = {
			...createProducerItem({
				id: "deposit-self",
				input: [
					{
						...depositInput("deposit-self", {
							from: "self",
						}),
						query: {
							scope: "board" as const,
							distance: "self" as const,
							selector: {
								type: "item" as const,
								itemId: "deposit-self",
							},
						},
					},
				],
			}),
			charges: {
				amount: 1,
			},
		};

		expect(
			await chargeDiagnostics({
				[materialTarget.id]: materialTarget,
				[depositSelf.id]: depositSelf,
				material: createSimpleItem("material"),
			}),
		).toEqual([
			expect.objectContaining({
				reason: InvalidInputChargesReasonEnumSchema.enum.TargetRequiresDeposit,
			}),
		]);
	});

	it("allows a Space deposit requirement to charge its action owner", async () => {
		const portal = {
			...createSimpleItem("space:owner-paid"),
			type: "space" as const,
			space: 1,
			charges: {
				amount: 2,
			},
			input: [
				depositInput("payer", {
					from: "self",
				}),
			],
		};
		const payer = {
			...createSimpleItem("payer"),
			scope: "board" as const,
			charges: {
				amount: 1,
			},
		};

		expect(
			await chargeDiagnostics({
				[portal.id]: portal,
				[payer.id]: payer,
			}),
		).toEqual([]);
	});

	it("rejects an exact inventory-only external payer", async () => {
		const producer = createProducerItem({
			id: "exact-inventory-target",
			input: [
				exactDepositInput("inventory-target"),
			],
		});
		const target = {
			...createSimpleItem("inventory-target"),
			scope: "inventory" as const,
			charges: {
				amount: 1,
			},
		};

		expect(
			await chargeDiagnostics({
				[producer.id]: producer,
				[target.id]: target,
			}),
		).toEqual([
			expect.objectContaining({
				reason: InvalidInputChargesReasonEnumSchema.enum.TargetUnavailable,
			}),
		]);
	});

	it("rejects a selector that matches only inventory-only charged items", async () => {
		const producer = createProducerItem({
			id: "inventory-selector-target",
			input: [
				depositInput("inventory-source"),
			],
		});
		const target = {
			...createSimpleItem("inventory-source"),
			scope: "inventory" as const,
			charges: {
				amount: 1,
			},
		};

		expect(
			await chargeDiagnostics({
				[producer.id]: producer,
				[target.id]: target,
			}),
		).toEqual([
			expect.objectContaining({
				reason: InvalidInputChargesReasonEnumSchema.enum.TargetUnavailable,
			}),
		]);
	});

	it("accepts board and any external payer scopes", async () => {
		const boardProducer = createProducerItem({
			id: "board-capable-target",
			input: [
				depositInput("board-source"),
			],
		});
		const anyProducer = createProducerItem({
			id: "any-capable-target",
			input: [
				depositInput("any-source"),
			],
		});
		const boardTarget = {
			...createSimpleItem("board-source"),
			scope: "board" as const,
			charges: {
				amount: 1,
			},
		};
		const anyTarget = {
			...createSimpleItem("any-source"),
			charges: {
				amount: 1,
			},
		};

		expect(
			await chargeDiagnostics({
				[boardProducer.id]: boardProducer,
				[boardTarget.id]: boardTarget,
			}),
		).toEqual([]);
		expect(
			await chargeDiagnostics({
				[anyProducer.id]: anyProducer,
				[anyTarget.id]: anyTarget,
			}),
		).toEqual([]);
	});

	it("requires a deposit selector to match at least one sufficiently charged item", async () => {
		const producer = createProducerItem({
			id: "producer",
			input: [
				depositInput("weak", {
					cost: 2,
				}),
			],
		});
		const weak = {
			...createSimpleItem("weak"),
			scope: "board" as const,
			charges: {
				amount: 1,
			},
		};

		expect(
			await chargeDiagnostics({
				[producer.id]: producer,
				[weak.id]: weak,
			}),
		).toEqual([
			expect.objectContaining({
				reason: InvalidInputChargesReasonEnumSchema.enum.TargetUnavailable,
			}),
		]);
	});

	it("rejects aggregate exact-target costs above finite authored charge supply", async () => {
		const producer = createProducerItem({
			id: "aggregate-target",
			input: [
				exactDepositInput("payer"),
				exactDepositInput("payer"),
			],
		});
		const payer = {
			...createSimpleItem("payer"),
			scope: "board" as const,
			charges: {
				amount: 1,
			},
			maxCount: 1,
		};

		expect(
			await chargeDiagnostics({
				[producer.id]: producer,
				[payer.id]: payer,
			}),
		).toEqual([
			expect.objectContaining({
				inputIndex: 1,
				reason: InvalidInputChargesReasonEnumSchema.enum.TargetInsufficientTotalCharges,
			}),
		]);
	});

	it("accepts aggregate exact-target costs within finite or unknown authored supply", async () => {
		const producer = createProducerItem({
			id: "aggregate-target-valid",
			input: [
				exactDepositInput("payer"),
				exactDepositInput("payer"),
			],
		});
		const finitePayer = {
			...createSimpleItem("payer"),
			scope: "board" as const,
			charges: {
				amount: 1,
			},
			maxCount: 2,
		};
		const unboundedPayer = {
			...finitePayer,
			maxCount: undefined,
		};

		expect(
			await chargeDiagnostics({
				[producer.id]: producer,
				[finitePayer.id]: finitePayer,
			}),
		).toEqual([]);
		expect(
			await chargeDiagnostics({
				[producer.id]: producer,
				[unboundedPayer.id]: unboundedPayer,
			}),
		).toEqual([]);
	});

	it("accounts for independent exact target payers separately", async () => {
		const producer = createProducerItem({
			id: "independent-targets",
			input: [
				exactDepositInput("payer:a"),
				exactDepositInput("payer:b"),
			],
		});
		const payer = (id: string) => ({
			...createSimpleItem(id),
			scope: "board" as const,
			charges: {
				amount: 1,
			},
			maxCount: 1,
		});
		const first = payer("payer:a");
		const second = payer("payer:b");

		expect(
			await chargeDiagnostics({
				[producer.id]: producer,
				[first.id]: first,
				[second.id]: second,
			}),
		).toEqual([]);
	});

	it("accepts explicit self and target charge payers", async () => {
		const shrine = {
			...createProducerItem({
				id: "shrine",
				input: [
					{
						type: "simple",
						charges: {
							from: "self",
							cost: 2,
						},
					},
					depositInput("target", {
						cost: 2,
					}),
				],
			}),
			charges: {
				amount: 3,
			},
		};
		const target = {
			...createSimpleItem("target"),
			charges: {
				amount: 2,
			},
		};

		expect(
			await chargeDiagnostics({
				[shrine.id]: shrine,
				[target.id]: target,
			}),
		).toEqual([]);
	});
});
