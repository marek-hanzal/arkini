import type { OutcomeRuleSchema } from "~/outcome/schema/OutcomeRuleSchema";
import { expect, it } from "vitest";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readItemConnectionFactsFn } from "~/flow/fn/readItemConnectionFactsFn";
import { createMergeTestConfig } from "~test/item-merge/support/createMergeTestConfig";

it("keeps exact drop positions including repeated identities in output sets", () => {
	const drop = {
		type: "item" as const,
		itemUid: "result",
		placement: "drop" as const,
		quantity: {
			min: 1,
			max: 1,
		},
		rules: [],
	};
	const config = createMergeTestConfig({
		rule: {
			action: "use",
			effect: "keep",
			target: {
				type: "item",
				itemUid: "target",
			},
			outcome: {
				set: [
					{
						weight: 1,
						rules: [],
						roll: [
							{
								type: "guaranteed",
								outcome: [
									drop,
									drop,
								],
							},
						],
					},
					{
						weight: 2,
						rules: [],
						roll: [
							{
								type: "guaranteed",
								outcome: [
									drop,
								],
							},
						],
					},
					{
						weight: 1,
						rules: [],
						roll: [
							{
								type: "chance",
								chance: 0.5,
								outcome: [
									drop,
								],
							},
						],
					},
				],
			},
		},
	});
	const origins = [
		{
			setIndex: 0,
			rollIndex: 0,
			rollType: "guaranteed",
			outcomeIndex: 0,
		},
		{
			setIndex: 0,
			rollIndex: 0,
			rollType: "guaranteed",
			outcomeIndex: 1,
		},
		{
			setIndex: 1,
			rollIndex: 0,
			rollType: "guaranteed",
			outcomeIndex: 0,
		},
		{
			setIndex: 2,
			rollIndex: 0,
			rollType: "chance",
			outcomeIndex: 0,
		},
	].map((roll) => ({
		source: {
			type: "merge",
			mergeIndex: 0,
		},
		role: "output",
		roll,
	}));
	expect(readItemConnectionFactsFn(config, "source", "produces")).toEqual([
		{
			itemUid: "result",
			origins,
		},
	]);
	expect(readItemConnectionFactsFn(config, "result", "produced-by")).toEqual([
		{
			itemUid: "source",
			origins,
		},
	]);
});

it("retains input and condition positions without turning absence-only guards into dependencies", () => {
	const base = createMergeTestConfig({
		rule: {
			action: "use",
			effect: "keep",
			target: {
				type: "item",
				itemUid: "target",
			},
		},
	});
	const query = {
		distance: "far" as const,
		selector: {
			type: "item" as const,
			itemUid: "target",
		},
	};
	const exists = {
		type: "exists" as const,
		query,
	};
	const absent = {
		type: "count" as const,
		query,
		count: 0,
	};
	const rules = [
		{
			type: "enable" as const,
			when: [
				absent,
			],
		},
		{
			type: "enable" as const,
			when: [
				absent,
				exists,
				exists,
			],
		},
		{
			type: "disable" as const,
			when: [
				absent,
				exists,
			],
		},
		{
			type: "disable" as const,
			when: [
				absent,
				absent,
			],
		},
	];
	const input = [
		{
			type: "simple" as const,
		},
		{
			type: "units" as const,
			query,
		},
		{
			type: "units" as const,
			query,
		},
	];
	const item = base.items.result;
	const config = GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			result: {
				...item,
				lines: [
					{
						id: "line",
						title: "Line",
						description: "Line",
						default: true,
						show: true,
						enable: true,
						runtimeMs: 0,
						input,
						rules,
					},
				],
			},
		},
	});
	const source = {
		type: "line",
		lineIndex: 0,
		title: "Line",
	};
	const origins = [
		{
			source,
			role: "input",
			inputIndex: 1,
		},
		{
			source,
			role: "input",
			inputIndex: 2,
		},
		...[
			{
				ruleIndex: 1,
				whenIndex: 1,
			},
			{
				ruleIndex: 1,
				whenIndex: 2,
			},
			{
				ruleIndex: 3,
				whenIndex: 0,
			},
			{
				ruleIndex: 3,
				whenIndex: 1,
			},
		].map((condition) => ({
			source,
			role: "condition",
			condition,
		})),
	];
	expect(readItemConnectionFactsFn(config, "result", "inputs")).toEqual([
		{
			itemUid: "target",
			origins,
		},
	]);
	expect(
		readItemConnectionFactsFn(config, "target", "required-by").find(
			(connection) => connection.itemUid === "result",
		)?.origins,
	).toEqual(origins);
});

it("keeps set eligibility separate from individual drop conditions", () => {
	const rule: OutcomeRuleSchema.Type = {
		type: "enable",
		when: [
			{
				type: "exists" as const,
				query: {
					distance: "far",
					selector: {
						type: "item" as const,
						itemUid: "target",
					},
				},
			},
		],
	};
	const config = createMergeTestConfig({
		rule: {
			action: "use",
			effect: "keep",
			target: {
				type: "item",
				itemUid: "target",
			},
			outcome: {
				set: [
					{
						weight: 1,
						rules: [
							rule,
						],
						roll: [
							{
								type: "guaranteed",
								outcome: [
									{
										type: "item",
										itemUid: "result",
										quantity: {
											min: 1,
											max: 1,
										},
										placement: "drop",
										rules: [
											rule,
										],
									},
								],
							},
						],
					},
				],
			},
		},
	});
	const connection = readItemConnectionFactsFn(config, "source", "inputs").find(
		({ itemUid }) => itemUid === "target",
	);
	expect(connection?.origins.filter(({ role }) => role === "condition")).toEqual([
		{
			source: {
				type: "merge",
				mergeIndex: 0,
			},
			role: "condition",
			condition: {
				ruleIndex: 0,
				whenIndex: 0,
			},
			setIndex: 0,
		},
		{
			source: {
				type: "merge",
				mergeIndex: 0,
			},
			role: "condition",
			condition: {
				ruleIndex: 0,
				whenIndex: 0,
			},
			roll: {
				setIndex: 0,
				rollIndex: 0,
				outcomeIndex: 0,
				rollType: "guaranteed",
			},
		},
	]);
});
