import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/v1/compiler/fx/compileGameSourcesFx";
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
