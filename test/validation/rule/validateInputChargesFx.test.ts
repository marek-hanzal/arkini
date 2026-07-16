import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/engine/compiler/fx/compileGameSourcesFx";
import {
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";

const chargeDiagnostics = async (items: Record<string, unknown>) =>
	(
		await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items,
				}),
			]),
		)
	).diagnostics.filter(({ code }) => code === "input:charges-invalid");

const depositInput = ({
	cost = 1,
	from = "target",
}: {
	cost?: number;
	from?: "self" | "target";
} = {}) => ({
	type: "deposit" as const,
	query: {
		scope: "board" as const,
		distance: "close" as const,
		selector: {
			type: "tag" as const,
			tag: "source",
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

describe("validateInputChargesFx", () => {
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
							type: "tag",
							tag: "source",
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
				reason: "deposit-missing-target-cost",
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
					reason: "self-missing-charges",
				}),
				expect.objectContaining({
					ownerItemId: insufficient.id,
					reason: "self-insufficient-charges",
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
				reason: "self-insufficient-charges",
			}),
		]);
	});

	it("rejects target costs outside deposit inputs and deposit self costs", async () => {
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
						type: "value",
						value: 1,
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
					depositInput({
						from: "self",
					}),
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
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					reason: "target-requires-deposit",
				}),
				expect.objectContaining({
					reason: "deposit-must-target",
				}),
			]),
		);
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
				reason: "target-unavailable",
			}),
		]);
	});

	it("rejects a selector that matches only inventory-only charged items", async () => {
		const producer = createProducerItem({
			id: "inventory-selector-target",
			input: [
				depositInput(),
			],
		});
		const target = {
			...createSimpleItem("inventory-source", [
				"source",
			]),
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
				reason: "target-unavailable",
			}),
		]);
	});

	it("accepts board and any external payer scopes", async () => {
		const producer = createProducerItem({
			id: "board-capable-target",
			input: [
				depositInput(),
			],
		});
		const boardTarget = {
			...createSimpleItem("board-source", [
				"source",
			]),
			scope: "board" as const,
			charges: {
				amount: 1,
			},
		};
		const anyTarget = {
			...createSimpleItem("any-source", [
				"source",
			]),
			charges: {
				amount: 1,
			},
		};

		expect(
			await chargeDiagnostics({
				[producer.id]: producer,
				[boardTarget.id]: boardTarget,
			}),
		).toEqual([]);
		expect(
			await chargeDiagnostics({
				[producer.id]: producer,
				[anyTarget.id]: anyTarget,
			}),
		).toEqual([]);
	});

	it("accepts a mixed selector when at least one charged match is board-capable", async () => {
		const producer = createProducerItem({
			id: "mixed-selector-target",
			input: [
				depositInput(),
			],
		});
		const inventoryTarget = {
			...createSimpleItem("inventory-source", [
				"source",
			]),
			scope: "inventory" as const,
			charges: {
				amount: 1,
			},
		};
		const boardTarget = {
			...createSimpleItem("board-source", [
				"source",
			]),
			scope: "board" as const,
			charges: {
				amount: 1,
			},
		};

		expect(
			await chargeDiagnostics({
				[producer.id]: producer,
				[inventoryTarget.id]: inventoryTarget,
				[boardTarget.id]: boardTarget,
			}),
		).toEqual([]);
	});

	it("requires a deposit selector to match at least one sufficiently charged item", async () => {
		const producer = createProducerItem({
			id: "producer",
			input: [
				depositInput({
					cost: 2,
				}),
			],
		});
		const weak = {
			...createSimpleItem("weak", [
				"source",
			]),
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
				reason: "target-unavailable",
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
				reason: "target-insufficient-total-charges",
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
					depositInput({
						cost: 2,
					}),
				],
			}),
			charges: {
				amount: 3,
			},
		};
		const target = {
			...createSimpleItem("target", [
				"source",
			]),
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
