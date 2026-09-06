import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/game-config-compiler/fx/compileGameSourcesFx";
import {
	createRootSource,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { InvalidMergeReasonEnumSchema } from "~/game-config-diagnostic/schema/InvalidMergeReasonEnumSchema";

const compileDiagnostics = async (items: Record<string, unknown>) =>
	(
		await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items,
				}),
			]),
		)
	).diagnostics;

const mergeSource = ({
	action = "consume",
	charges,
	effect = "keep",
	maxCount,
	result,
	target,
}: {
	action?: "consume" | "deposit";
	charges?: {
		amount: number;
	};
	effect?: "keep" | "replace";
	maxCount?: number;
	result?: string;
	target: {
		type: "item";
		itemId: string;
	};
}) => ({
	...createSimpleItem("source"),
	charges,
	maxCount,
	merge: [
		effect === "replace"
			? {
					target,
					action,
					effect,
					result: result ?? "result",
				}
			: {
					target,
					action,
					effect,
				},
	],
});

const mergeDiagnostics = async (items: Record<string, unknown>) =>
	(await compileDiagnostics(items)).filter(
		({ code }) => code === DiagnosticCodeEnumSchema.enum.MergeInvalid,
	);

describe("validateMergeViabilityFn", () => {
	it("requires Charges on a source that uses the Deposit action", async () => {
		const source = mergeSource({
			action: "deposit",
			target: {
				type: "item",
				itemId: "target",
			},
		});
		const target = createSimpleItem("target");

		expect(
			await mergeDiagnostics({
				[source.id]: source,
				[target.id]: target,
			}),
		).toEqual([
			expect.objectContaining({
				path: [
					"items",
					"source",
					"merge",
					0,
					"action",
				],
				reason: InvalidMergeReasonEnumSchema.enum.SourceChargesDisabled,
			}),
		]);
	});

	it("accepts Deposit when the merge source has Charges", async () => {
		const source = mergeSource({
			action: "deposit",
			charges: {
				amount: 2,
			},
			target: {
				type: "item",
				itemId: "target",
			},
		});
		const target = createSimpleItem("target");

		expect(
			await mergeDiagnostics({
				[source.id]: source,
				[target.id]: target,
			}),
		).toEqual([]);
	});

	it("rejects an exact inventory-only merge target", async () => {
		const source = mergeSource({
			target: {
				type: "item",
				itemId: "target",
			},
		});
		const target = {
			...createSimpleItem("target"),
			scope: "inventory" as const,
		};

		expect(
			await mergeDiagnostics({
				[source.id]: source,
				[target.id]: target,
			}),
		).toEqual([
			expect.objectContaining({
				ownerItemId: source.id,
				mergeIndex: 0,
				reason: InvalidMergeReasonEnumSchema.enum.TargetUnavailable,
			}),
		]);
	});

	it("rejects an exact self-target when maxCount allows only one identity", async () => {
		const source = mergeSource({
			maxCount: 1,
			target: {
				type: "item",
				itemId: "source",
			},
		});

		expect(
			await mergeDiagnostics({
				[source.id]: source,
			}),
		).toEqual([
			expect.objectContaining({
				reason: InvalidMergeReasonEnumSchema.enum.SelfTargetUnavailable,
			}),
		]);
	});

	it("does not reject exact self-target merely when a second identity is possible", async () => {
		const source = mergeSource({
			maxCount: 2,
			target: {
				type: "item",
				itemId: "source",
			},
		});

		expect(
			await mergeDiagnostics({
				[source.id]: source,
			}),
		).toEqual([]);
	});

	it("rejects an inventory-only replacement result", async () => {
		const source = mergeSource({
			effect: "replace",
			result: "result",
			target: {
				type: "item",
				itemId: "target",
			},
		});
		const target = createSimpleItem("target");
		const result = {
			...createSimpleItem("result"),
			scope: "inventory" as const,
		};

		expect(
			await mergeDiagnostics({
				[source.id]: source,
				[target.id]: target,
				[result.id]: result,
			}),
		).toEqual([
			expect.objectContaining({
				reason: InvalidMergeReasonEnumSchema.enum.ResultUnavailable,
			}),
		]);
	});

	it("accepts a board-capable replacement result", async () => {
		const source = mergeSource({
			effect: "replace",
			result: "result",
			target: {
				type: "item",
				itemId: "target",
			},
		});
		const target = createSimpleItem("target");
		const result = {
			...createSimpleItem("result"),
			scope: "board" as const,
		};

		expect(
			await mergeDiagnostics({
				[source.id]: source,
				[target.id]: target,
				[result.id]: result,
			}),
		).toEqual([]);
	});

	it("leaves missing target and result references to reference validation", async () => {
		const source = mergeSource({
			effect: "replace",
			result: "missing:result",
			target: {
				type: "item",
				itemId: "missing:target",
			},
		});
		const diagnostics = await compileDiagnostics({
			[source.id]: source,
		});

		expect(
			diagnostics.filter(({ code }) => code === DiagnosticCodeEnumSchema.enum.MergeInvalid),
		).toEqual([]);
		expect(
			diagnostics.filter(
				({ code }) => code === DiagnosticCodeEnumSchema.enum.ConfigMissingReference,
			),
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					referenceId: "missing:target",
				}),
				expect.objectContaining({
					referenceId: "missing:result",
				}),
			]),
		);
	});
});
