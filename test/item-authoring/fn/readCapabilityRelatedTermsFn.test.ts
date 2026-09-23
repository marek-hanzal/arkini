import { expect, it } from "vitest";

import { readCapabilityRelatedTermsFn } from "~/item-authoring/fn/readCapabilityRelatedTermsFn";
import { createLineFn } from "~/production-authoring/fn/createLineFn";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";

const dropFn = (itemId: string): OutcomeSchema.Type => ({
	itemId,
	type: "item" as const,
	quantity: {
		min: 1,
		max: 1,
	},
	placement: "drop",
	rules: [],
});

it("finds inputs, rule dependencies and every authored outcome alternative without expanding their capabilities", () => {
	const line: LineSchema.Type = {
		...createLineFn([], "Line", "Description"),
		input: [
			{
				type: "materials",
				query: {
					distance: "far",
					selector: {
						type: "item",
						itemId: "water",
					},
				},
				mode: "consume",
				quantity: {
					min: 1,
					max: 1,
				},
			},
			{
				type: "units",
				query: {
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
							distance: "far",
							selector: {
								type: "item",
								itemId: "permit",
							},
						},
					},
				],
			},
		],
		outcome: {
			set: [
				{
					weight: 1,
					rules: [],
					roll: [
						{
							type: "guaranteed",
							outcome: [
								dropFn("water"),
							],
						},
						{
							type: "chance",
							chance: 0.5,
							outcome: [
								dropFn("chance-result"),
							],
						},
					],
				},
				{
					weight: 3,
					rules: [
						{
							type: "enable",
							when: [
								{
									type: "exists",
									query: {
										distance: "far",
										selector: {
											type: "item",
											itemId: "set-permit",
										},
									},
								},
							],
						},
					],
					roll: [
						{
							type: "guaranteed",
							outcome: [
								dropFn("alternative-a"),
								{
									...dropFn("alternative-b"),
									rules: [
										{
											type: "enable",
											when: [
												{
													type: "exists",
													query: {
														distance: "far",
														selector: {
															type: "item",
															itemId: "outcome-permit",
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
		"set-permit",
		"alternative-a",
		"alternative-b",
		"outcome-permit",
	]);
});

it("finds merge targets, replacement items and extra outcome by ID and title", () => {
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
				outcome: {
					set: [
						{
							weight: 1,
							rules: [],
							roll: [
								{
									type: "guaranteed",
									outcome: [
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
