import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/engine/compiler/fx/compileGameSourcesFx";
import {
	createRootSource,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { InvalidMergeReasonEnumSchema } from "~/engine/validation/schema/InvalidMergeReasonEnumSchema";

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
	effect = "keep",
	maxCount,
	result,
	target,
}: {
	effect?: "keep" | "replace";
	maxCount?: number;
	result?: string;
	target:
		| {
				type: "item";
				itemId: string;
		  }
		| {
				type: "tag";
				tag: string;
		  };
}) => ({
	...createSimpleItem("source"),
	maxCount,
	merge: [
		effect === "replace"
			? {
					target,
					action: "consume" as const,
					effect,
					result: result ?? "result",
				}
			: {
					target,
					action: "consume" as const,
					effect,
				},
	],
});

const mergeDiagnostics = async (items: Record<string, unknown>) =>
	(await compileDiagnostics(items)).filter(({ code }) => code === DiagnosticCodeEnumSchema.enum.MergeInvalid);

describe("validateMergeViabilityFx", () => {
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

	it("rejects a tag selector matching only inventory-only targets", async () => {
		const source = mergeSource({
			target: {
				type: "tag",
				tag: "target",
			},
		});
		const target = {
			...createSimpleItem("target", [
				"target",
			]),
			scope: "inventory" as const,
		};

		expect(
			await mergeDiagnostics({
				[source.id]: source,
				[target.id]: target,
			}),
		).toEqual([
			expect.objectContaining({
				reason: InvalidMergeReasonEnumSchema.enum.TargetUnavailable,
			}),
		]);
	});

	it("accepts a selector with at least one board-capable target", async () => {
		const source = mergeSource({
			target: {
				type: "tag",
				tag: "target",
			},
		});
		const inventoryTarget = {
			...createSimpleItem("target:inventory", [
				"target",
			]),
			scope: "inventory" as const,
		};
		const boardTarget = {
			...createSimpleItem("target:board", [
				"target",
			]),
			scope: "board" as const,
		};

		expect(
			await mergeDiagnostics({
				[source.id]: source,
				[inventoryTarget.id]: inventoryTarget,
				[boardTarget.id]: boardTarget,
			}),
		).toEqual([]);
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

	it("keeps a tag selector viable when it includes another board target", async () => {
		const source = {
			...mergeSource({
				maxCount: 1,
				target: {
					type: "tag",
					tag: "target",
				},
			}),
			tags: [
				"target",
			],
		};
		const target = createSimpleItem("target", [
			"target",
		]);

		expect(
			await mergeDiagnostics({
				[source.id]: source,
				[target.id]: target,
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

		expect(diagnostics.filter(({ code }) => code === DiagnosticCodeEnumSchema.enum.MergeInvalid)).toEqual([]);
		expect(diagnostics.filter(({ code }) => code === DiagnosticCodeEnumSchema.enum.ConfigMissingReference)).toEqual(
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
