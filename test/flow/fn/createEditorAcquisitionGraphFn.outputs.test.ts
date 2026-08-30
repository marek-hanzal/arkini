import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createEditorAcquisitionGraphFn } from "~/flow/fn/createEditorAcquisitionGraphFn";
import { compileGameSourcesFx } from "~/game-config/compiler/fx/compileGameSourcesFx";
import { OutputSchema } from "~/production-output/schema/OutputSchema";
import {
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/game-config/validation/support/gameValidationTestSource";

describe("createEditorAcquisitionGraphFn output distributions", () => {
	it("keeps authored occurrences and marks the shared operation when joint compilation overflows", async () => {
		const output = OutputSchema.parse({
			set: [
				{
					roll: Array.from(
						{
							length: 14,
						},
						(_, index) => ({
							chance: 0.5,
							drop: [
								{
									itemId: `chance:${index}`,
									quantity: {
										max: 1,
										min: 1,
									},
									rules: [],
								},
							],
							type: "chance" as const,
						}),
					),
					weight: 1,
				},
			],
		});
		const items = Object.fromEntries(
			Array.from(
				{
					length: 14,
				},
				(_, index) => [
					`chance:${index}`,
					createSimpleItem(`chance:${index}`),
				],
			),
		);
		const result = await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items: {
						...items,
						maker: createProducerItem({
							id: "maker",
							output,
						}),
					},
				}),
			]),
		);
		expect(result.diagnostics).toEqual([]);
		if (result.config === undefined) throw new Error("Expected valid bounded-output fixture.");

		const routes = createEditorAcquisitionGraphFn(result.config).routes.filter(
			({ metadata }) => metadata.kind === "line-output",
		);
		expect(routes).toHaveLength(14);
		expect(routes.map(({ operation }) => operation?.outputCompilation)).toEqual(
			Array.from(
				{
					length: 14,
				},
				() => "state-space-unsupported",
			),
		);
		expect(routes.every(({ operation }) => operation?.outputDistribution?.length === 0)).toBe(
			true,
		);
	});
});
