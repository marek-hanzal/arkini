import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/v1/compiler/fx/compileGameSourcesFx";
import { OutputSchema } from "~/v1/output/schema/OutputSchema";
import {
	createOutput,
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";

const compileOutput = async (output: OutputSchema.Type) => {
	const replacement = createSimpleItem("item:replacement");
	const owner = createProducerItem({
		id: "item:owner",
		output,
	});
	return await Effect.runPromise(
		compileGameSourcesFx([
			createRootSource({
				items: {
					[owner.id]: owner,
					[replacement.id]: replacement,
				},
			}),
		]),
	);
};

const diagnostics = async (output: OutputSchema.Type) =>
	(await compileOutput(output)).diagnostics.filter(
		({ code }) => code === "output:multiple-replace",
	);

describe("validateOutputReplaceCardinalityFx", () => {
	it("rejects two replace drops emitted by one guaranteed roll", async () => {
		expect(
			await diagnostics(
				createOutput([
					{
						itemId: "item:replacement",
						placement: "replace",
					},
					{
						itemId: "item:replacement",
						placement: "replace",
					},
				]),
			),
		).toEqual([
			expect.objectContaining({
				maximum: 2,
			}),
		]);
	});

	it("rejects a weighted replace candidate selected multiple times", async () => {
		const output = OutputSchema.parse({
			set: [
				{
					roll: [
						{
							type: "weight",
							quantity: {
								type: "value",
								value: 2,
							},
							drop: [
								{
									weight: 1,
									drop: [
										{
											itemId: "item:replacement",
											quantity: {
												type: "value",
												value: 1,
											},
											placement: "replace",
											rules: [],
										},
									],
								},
								{
									weight: 1,
									drop: [
										{
											itemId: "item:replacement",
											quantity: {
												type: "value",
												value: 1,
											},
											placement: "drop",
											rules: [],
										},
									],
								},
							],
						},
					],
				},
			],
		});

		expect(await diagnostics(output)).toEqual([
			expect.objectContaining({
				maximum: 2,
			}),
		]);
	});

	it("accepts alternative roll sets that each replace at most once", async () => {
		const replacementDrop = {
			itemId: "item:replacement",
			quantity: {
				type: "value" as const,
				value: 1,
			},
			placement: "replace" as const,
			rules: [],
		};
		const output = OutputSchema.parse({
			set: [
				{
					roll: [
						{
							type: "guaranteed",
							drop: [
								replacementDrop,
							],
						},
					],
				},
				{
					roll: [
						{
							type: "guaranteed",
							drop: [
								replacementDrop,
							],
						},
					],
				},
			],
		});

		expect(await diagnostics(output)).toEqual([]);
	});
});
