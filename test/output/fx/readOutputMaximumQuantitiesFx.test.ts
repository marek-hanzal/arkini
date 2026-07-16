import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readOutputMaximumQuantitiesFx } from "~/engine/output/fx/readOutputMaximumQuantitiesFx";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";

const value = (amount: number) => ({
	type: "value" as const,
	value: amount,
});
const range = (min: number, max: number) => ({
	type: "range" as const,
	min,
	max,
});

describe("readOutputMaximumQuantitiesFx", () => {
	it("takes the maximum across alternative sets while summing rolls inside one set", () => {
		const output: OutputSchema.Type = {
			set: [
				{
					roll: [
						{
							type: "guaranteed",
							drop: [
								{
									itemId: "item:a",
									quantity: value(2),
									placement: "drop",
									rules: [],
								},
							],
						},
						{
							type: "chance",
							chance: 0.1,
							drop: [
								{
									itemId: "item:a",
									quantity: range(1, 4),
									placement: "drop",
									rules: [],
								},
								{
									itemId: "item:b",
									quantity: value(1),
									placement: "drop",
									rules: [],
								},
							],
						},
					],
				},
				{
					roll: [
						{
							type: "guaranteed",
							drop: [
								{
									itemId: "item:a",
									quantity: value(5),
									placement: "drop",
									rules: [],
								},
								{
									itemId: "item:b",
									quantity: value(3),
									placement: "drop",
									rules: [],
								},
							],
						},
					],
				},
			],
		};

		const quantities = Effect.runSync(
			readOutputMaximumQuantitiesFx({
				output,
			}),
		);

		expect(Object.fromEntries(quantities)).toEqual({
			"item:a": 6,
			"item:b": 3,
		});
	});

	it("reserves the worst repeatable weighted candidate and maximum selection range", () => {
		const output: OutputSchema.Type = {
			set: [
				{
					roll: [
						{
							type: "weight",
							quantity: range(1, 5),
							drop: [
								{
									weight: 1,
									drop: [
										{
											itemId: "item:a",
											quantity: value(2),
											placement: "drop",
											rules: [],
										},
										{
											itemId: "item:b",
											quantity: value(1),
											placement: "drop",
											rules: [],
										},
									],
								},
								{
									weight: 1,
									drop: [
										{
											itemId: "item:a",
											quantity: value(1),
											placement: "drop",
											rules: [],
										},
										{
											itemId: "item:b",
											quantity: value(4),
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
		};

		const quantities = Effect.runSync(
			readOutputMaximumQuantitiesFx({
				output,
			}),
		);

		expect(Object.fromEntries(quantities)).toEqual({
			"item:a": 10,
			"item:b": 20,
		});
	});
});
