import { describe, expect, it } from "vitest";

import { readEditorAcquisitionOutputOccurrencesFn } from "~/editor/acquisition/fn/readEditorAcquisitionOutputOccurrencesFn";
import { OutputSchema } from "~/engine/output/schema/OutputSchema";

const read = (input: unknown) =>
	readEditorAcquisitionOutputOccurrencesFn(OutputSchema.parse(input));

describe("readEditorAcquisitionOutputOccurrencesFn", () => {
	it("projects weighted selections and quantity ranges into scalar expected yields", () => {
		const result = read({
			set: [
				{
					roll: [
						{
							drop: [
								{
									drop: [
										{
											itemId: "a",
											placement: "drop",
											quantity: {
												min: 1,
												max: 3,
											},
											rules: [],
										},
									],
									weight: 1,
								},
								{
									drop: [
										{
											itemId: "b",
											placement: "drop",
											quantity: {
												min: 2,
												max: 2,
											},
											rules: [],
										},
									],
									weight: 3,
								},
							],
							quantity: {
								min: 2,
								max: 4,
							},
							type: "weight",
						},
					],
				},
			],
		});

		expect(
			result.occurrences.map(({ expectedYield, factId }) => ({
				expectedYield,
				factId,
			})),
		).toEqual([
			{
				expectedYield: 1.5,
				factId: "a",
			},
			{
				expectedYield: 4.5,
				factId: "b",
			},
		]);
	});

	it("credits repeated same-fact drops with their combined linear expectation", () => {
		const result = read({
			set: [
				{
					roll: [
						{
							drop: [
								{
									itemId: "a",
									placement: "drop",
									quantity: {
										min: 1,
										max: 1,
									},
									rules: [],
								},
								{
									itemId: "a",
									placement: "drop",
									quantity: {
										min: 2,
										max: 2,
									},
									rules: [],
								},
							],
							type: "guaranteed",
						},
					],
				},
			],
		});

		expect(result.occurrences).toHaveLength(2);
		expect(result.occurrences.map(({ expectedYield }) => expectedYield)).toEqual([
			3,
			3,
		]);
	});

	it("keeps large authored ranges scalar instead of imposing a state-space bound", () => {
		const result = read({
			set: [
				{
					roll: [
						{
							drop: [
								{
									itemId: "a",
									placement: "drop",
									quantity: {
										min: 1,
										max: 100_000,
									},
									rules: [],
								},
							],
							type: "guaranteed",
						},
					],
				},
			],
		});

		expect(result.occurrences[0]?.expectedYield).toBe(50_000.5);
	});
});
