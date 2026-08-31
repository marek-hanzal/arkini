import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/game-config/compiler/fx/compileGameSourcesFx";
import type { InputSchema } from "~/production-input/schema/InputSchema";
import {
	createLine,
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/game-config/validation/support/gameValidationTestSource";
import { DiagnosticCodeEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticCodeEnumSchema";

const bufferedInput = (capacity: number): ReadonlyArray<InputSchema.Type> => [
	{
		type: "materials",
		selector: {
			type: "item",
			itemId: "item:material",
		},
		quantity: {
			min: 1,
			max: 1,
		},
		capacity,
		mode: "consume",
	},
];

const lineOwner = (type: "blueprint" | "craft" | "stash", capacity: number) => ({
	...createSimpleItem(`item:${type}`),
	type,
	charges: {
		amount: 1,
	},
	line: createLine({
		input: bufferedInput(capacity),
	}),
});

const diagnostics = async (items: Record<string, unknown>) =>
	(
		await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items: {
						"item:material": createSimpleItem("item:material"),
						...items,
					},
				}),
			]),
		)
	).diagnostics.filter(
		({ code }) => code === DiagnosticCodeEnumSchema.enum.InputCapacityUnsupported,
	);

describe("validateLineInputCapacityFn", () => {
	it("allows positive material capacity on producer lines", async () => {
		const producer = createProducerItem({
			id: "item:producer",
			input: bufferedInput(2),
		});

		expect(
			await diagnostics({
				[producer.id]: producer,
			}),
		).toEqual([]);
	});

	it.each([
		"blueprint",
		"craft",
		"stash",
	] as const)("rejects positive material capacity on %s lines", async (type) => {
		const owner = lineOwner(type, 2);

		expect(
			await diagnostics({
				[owner.id]: owner,
			}),
		).toEqual([
			expect.objectContaining({
				ownerItemId: owner.id,
				lineId: "line:test",
				inputIndex: 0,
				capacity: 2,
			}),
		]);
	});

	it("accepts zero material capacity on non-producer lines", async () => {
		const craft = lineOwner("craft", 0);

		expect(
			await diagnostics({
				[craft.id]: craft,
			}),
		).toEqual([]);
	});
});
