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
	units,
	effect = "keep",
	result,
	target,
}: {
	action?: "consume" | "spend";
	units?: {
		amount: number;
	};
	effect?: "spend" | "keep" | "replace";
	result?: string;
	target: {
		type: "item";
		itemId: string;
	};
}) => ({
	...createSimpleItem("source"),
	units,
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
	it("checks receiver Units for a Space interaction target Spend", async () => {
		const portal = {
			...createSimpleItem("portal"),
			merge: [
				{
					action: "space",
					space: 1,
					effect: "spend",
				},
			],
		};
		expect(
			await mergeDiagnostics({
				portal,
			}),
		).toMatchObject([
			{
				reason: InvalidMergeReasonEnumSchema.enum.TargetUnitsDisabled,
			},
		]);
		expect(
			await mergeDiagnostics({
				portal: {
					...portal,
					units: {
						amount: 2,
					},
				},
			}),
		).toEqual([]);
	});

	it("requires Units on a source that uses the Spend action", async () => {
		const source = mergeSource({
			action: "spend",
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
				reason: InvalidMergeReasonEnumSchema.enum.SourceUnitsDisabled,
			}),
		]);
	});

	it("accepts Units when the merge source has Units", async () => {
		const source = mergeSource({
			action: "spend",
			units: {
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

	it("requires Units on the selected target of a Spend effect", async () => {
		const source = mergeSource({
			effect: "spend",
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
					"effect",
				],
				reason: InvalidMergeReasonEnumSchema.enum.TargetUnitsDisabled,
			}),
		]);
	});

	it("accepts a Spend effect when the selected target has Units", async () => {
		const source = mergeSource({
			effect: "spend",
			target: {
				type: "item",
				itemId: "target",
			},
		});
		const target = {
			...createSimpleItem("target"),
			units: {
				amount: 2,
			},
		};

		expect(
			await mergeDiagnostics({
				[source.id]: source,
				[target.id]: target,
			}),
		).toEqual([]);
	});

	it("does not reject exact self-target merely when a second identity is possible", async () => {
		const source = mergeSource({
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
