import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/v1/compiler/fx/compileGameSourcesFx";
import type { InputSchema } from "~/v1/input/schema/InputSchema";
import {
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";

const temporaryItem = (id: string, tags: string[] = []) => ({
	...createSimpleItem(id, tags),
	type: "temporary" as const,
	scope: "board" as const,
	maxStackSize: 1,
	durationMs: 600,
});

const materialInput = (
	selector:
		| {
				type: "item";
				itemId: string;
		  }
		| {
				type: "tag";
				tag: string;
		  },
): ReadonlyArray<InputSchema.Type> => [
	{
		type: "materials",
		selector,
		quantity: {
			type: "value",
			value: 1,
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
	).diagnostics.filter(({ code }) => code === "input:material-ineligible");

describe("validateMaterialInputEligibilityFx", () => {
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

	it("rejects a tag selector when any matched candidate is ineligible", async () => {
		const owner = createProducerItem({
			id: "producer:test",
			input: materialInput({
				type: "tag",
				tag: "material:test",
			}),
		});
		const ordinary = createSimpleItem("item:ordinary", [
			"material:test",
		]);
		const temporary = temporaryItem("temporary:test", [
			"material:test",
		]);

		expect(
			await diagnostics({
				[owner.id]: owner,
				[ordinary.id]: ordinary,
				[temporary.id]: temporary,
			}),
		).toEqual([
			expect.objectContaining({
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
			compiled.diagnostics.filter(({ code }) => code === "input:material-ineligible"),
		).toEqual([]);
		expect(
			compiled.diagnostics.filter(({ code }) => code === "config:missing-reference"),
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
