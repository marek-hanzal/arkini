import { expect, it } from "vitest";

import { readCapabilityRelatedTermsFn } from "~/item-authoring/fn/readCapabilityRelatedTermsFn";
import { createLineFn } from "~/production-authoring/fn/createLineFn";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { DropSchema } from "~/production-output/schema/DropSchema";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";

const dropFn = (itemId: string): DropSchema.Type => ({
	itemId,
	quantity: {
		min: 1,
		max: 1,
	},
	placement: "drop",
	rules: [],
});

it("finds inputs, rule dependencies and every authored output alternative without expanding their capabilities", () => {
	const line: LineSchema.Type = {
		...createLineFn([], "Line", "Description"),
		input: [
			{
				type: "materials",
				selector: {
					type: "item",
					itemId: "water",
				},
				mode: "consume",
				quantity: {
					min: 1,
					max: 1,
				},
				capacity: 0,
			},
			{
				type: "units",
				query: {
					scope: "board",
					distance: "close",
					selector: {
						type: "item",
						itemId: "fuel",
					},
				},
			},
		],
		rules: [
			{
				type: "enable",
				when: [
					{
						type: "exists",
						query: {
							scope: "any",
							selector: {
								type: "item",
								itemId: "permit",
							},
						},
					},
				],
			},
		],
		output: {
			set: [
				{
					weight: 1,
					roll: [
						{
							type: "guaranteed",
							drop: [
								dropFn("water"),
							],
						},
						{
							type: "chance",
							chance: 0.5,
							drop: [
								dropFn("chance-result"),
							],
						},
						{
							type: "weight",
							quantity: {
								min: 1,
								max: 1,
							},
							drop: [
								{
									weight: 1,
									drop: [
										dropFn("weighted-a"),
									],
								},
								{
									weight: 1,
									drop: [
										{
											...dropFn("weighted-b"),
											rules: [
												{
													type: "enable",
													when: [
														{
															type: "exists",
															query: {
																scope: "any",
																selector: {
																	type: "item",
																	itemId: "output-permit",
																},
															},
														},
													],
												},
											],
										},
									],
								},
							],
						},
					],
				},
			],
		},
	};
	const items = {
		water: {
			...editorTestConfig.items.water,
			lines: [
				createLineFn([], "Not searchable", "Not searchable"),
			],
		},
	};
	expect(readCapabilityRelatedTermsFn(line, items)).toEqual([
		"water",
		"Water",
		"fuel",
		"permit",
		"chance-result",
		"weighted-a",
		"weighted-b",
		"output-permit",
	]);
});

it("finds merge targets, replacement items and extra output by ID and title", () => {
	expect(
		readCapabilityRelatedTermsFn(
			{
				action: "consume",
				effect: "replace",
				target: {
					type: "item",
					itemId: "target",
				},
				result: "water",
				output: {
					set: [
						{
							weight: 1,
							roll: [
								{
									type: "guaranteed",
									drop: [
										dropFn("extra"),
									],
								},
							],
						},
					],
				},
			},
			editorTestConfig.items,
		),
	).toEqual([
		"target",
		"water",
		"Water",
		"extra",
	]);
});
