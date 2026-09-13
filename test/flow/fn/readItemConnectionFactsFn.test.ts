import { expect, it } from "vitest";

import { readItemConnectionFactsFn } from "~/flow/fn/readItemConnectionFactsFn";
import { createMergeTestConfig } from "~test/item-merge/support/createMergeTestConfig";

it("keeps distinct output sets and rolls while deduplicating repeated weighted drops", () => {
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
										weight: 1,
										drop: [
											drop,
											drop,
										],
									},
									{
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
			source: {
				type: "merge",
				mergeIndex: 0,
			},
			role: "output",
			roll: {
				setIndex: 0,
				rollIndex: 0,
				rollType: "guaranteed",
			},
		},
		{
			source: {
				type: "merge",
				mergeIndex: 0,
			},
			role: "output",
			roll: {
				setIndex: 0,
				rollIndex: 1,
				rollType: "weight",
			},
		},
		{
			source: {
				type: "merge",
				mergeIndex: 0,
			},
			role: "output",
			roll: {
				setIndex: 1,
				rollIndex: 0,
				rollType: "chance",
			},
		},
	];
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
