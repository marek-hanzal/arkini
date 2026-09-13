import { expect, it } from "vitest";

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
