import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/engine/compiler/fx/compileGameSourcesFx";
import type { InputSchema } from "~/engine/input/schema/InputSchema";
import {
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";

const temporaryItem = (id: string) => ({
	...createSimpleItem(id),
	type: "temporary" as const,
	scope: "board" as const,
	maxStackSize: 1,
	durationMs: 600,
});

const materialInput = (selector: {
	type: "item";
	itemId: string;
}): ReadonlyArray<InputSchema.Type> => [
	{
		type: "materials",
		selector,
		quantity: {
			min: 1,
			max: 1,
		},
		capacity: 0,
		mode: "consume",
	},
];

const diagnostics = async (items: Record<string, unknown>) =>
	(
		await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items,
				}),
			]),
		)
	).diagnostics.filter(
		({ code }) => code === DiagnosticCodeEnumSchema.enum.InputMaterialIneligible,
	);

describe("validateMaterialInputEligibilityFn", () => {
	it("rejects an exact temporary material candidate", async () => {
		const owner = createProducerItem({
			id: "producer:test",
			input: materialInput({
				type: "item",
				itemId: "temporary:test",
			}),
		});
		const temporary = temporaryItem("temporary:test");

		expect(
			await diagnostics({
				[owner.id]: owner,
				[temporary.id]: temporary,
			}),
		).toEqual([
			expect.objectContaining({
				ownerItemId: owner.id,
				lineId: "line:test",
				inputIndex: 0,
				candidateItemId: temporary.id,
			}),
		]);
	});

	it("leaves a missing exact candidate to reference validation", async () => {
		const owner = createProducerItem({
			id: "producer:test",
			input: materialInput({
				type: "item",
				itemId: "item:missing",
			}),
		});
		const compiled = await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items: {
						[owner.id]: owner,
					},
				}),
			]),
		);

		expect(
			compiled.diagnostics.filter(
				({ code }) => code === DiagnosticCodeEnumSchema.enum.InputMaterialIneligible,
			),
		).toEqual([]);
		expect(
			compiled.diagnostics.filter(
				({ code }) => code === DiagnosticCodeEnumSchema.enum.ConfigMissingReference,
			),
		).toEqual([
			expect.objectContaining({
				referenceId: "item:missing",
			}),
		]);
	});

	it("accepts ordinary material candidates", async () => {
		const owner = createProducerItem({
			id: "producer:test",
			input: materialInput({
				type: "item",
				itemId: "item:ordinary",
			}),
		});
		const ordinary = createSimpleItem("item:ordinary");

		expect(
			await diagnostics({
				[owner.id]: owner,
				[ordinary.id]: ordinary,
			}),
		).toEqual([]);
	});
});
