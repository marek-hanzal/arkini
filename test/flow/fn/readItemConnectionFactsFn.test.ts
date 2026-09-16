import { expect, it } from "vitest";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readItemConnectionFactsFn } from "~/flow/fn/readItemConnectionFactsFn";
import { createMergeTestConfig } from "~test/item-merge/support/createMergeTestConfig";

it("keeps exact drop positions including repeated identities in weighted candidates", () => {
	const drop = {
		itemId: "result",
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
				itemId: "target",
			},
			output: {
				set: [
					{
						weight: 1,
						roll: [
							{
								type: "guaranteed",
								drop: [
									drop,
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
										rules: [],
										weight: 1,
										drop: [
											drop,
											drop,
										],
									},
									{
										rules: [],
										weight: 2,
										drop: [
											drop,
										],
									},
								],
							},
						],
					},
					{
						weight: 1,
						roll: [
							{
								type: "chance",
								chance: 0.5,
								drop: [
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
			dropIndex: 0,
		},
		{
			setIndex: 0,
			rollIndex: 1,
			rollType: "weight",
			candidateIndex: 0,
			dropIndex: 0,
		},
		{
			setIndex: 0,
			rollIndex: 1,
			rollType: "weight",
			candidateIndex: 0,
			dropIndex: 1,
		},
		{
			setIndex: 0,
			rollIndex: 1,
			rollType: "weight",
			candidateIndex: 1,
			dropIndex: 0,
		},
		{
			setIndex: 1,
			rollIndex: 0,
			rollType: "chance",
			dropIndex: 0,
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
			itemId: "result",
			origins,
		},
	]);
	expect(readItemConnectionFactsFn(config, "result", "produced-by")).toEqual([
		{
			itemId: "source",
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
				itemId: "target",
			},
		},
	});
	const query = {
		scope: "board" as const,
		distance: "far" as const,
		selector: {
			type: "item" as const,
			itemId: "target",
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
			itemId: "target",
			origins,
		},
	]);
	expect(
		readItemConnectionFactsFn(config, "target", "required-by").find(
			(connection) => connection.itemId === "result",
		)?.origins,
	).toEqual(origins);
});
