import { expect, it } from "vitest";

import { readItemLineStatusesFn } from "~/item-detail-read/fn/readItemLineStatusesFn";
import type { readItemDetailQueueFx } from "~/item-detail-read/fx/readItemDetailQueueFx";

it("counts only each line's pending requests and keeps the active state ahead of its queue", () => {
	const queue = {
		kind: "available",
		active: [
			{
				jobId: "job",
				lineUid: "a",
				status: "running",
			},
		],
		request: [
			"a",
			"b",
			"a",
			"b",
			"b",
		].map((lineUid, index) => ({
			requestId: `request:${index}`,
			lineUid,
			status: "blocked-active" as const,
		})),
	} satisfies readItemDetailQueueFx.Result;
	const expected = [
		{
			lineUid: "a",
			state: "running",
			jobId: "job",
			queued: 2,
			requestId: "request:0",
		},
		{
			lineUid: "b",
			state: "queued",
			queued: 3,
			requestId: "request:1",
		},
	];
	expect(readItemLineStatusesFn(queue)).toEqual(expected);
	expect(
		readItemLineStatusesFn({
			...queue,
			active: [
				{
					...queue.active[0]!,
					status: "awaiting-outcome",
				},
			],
		})[0],
	).toEqual({
		lineUid: "a",
		state: "awaiting-outcome",
		jobId: "job",
		queued: 2,
		requestId: "request:0",
	});
});

it("distinguishes missing input from other start blockers without claiming that queued work is running", () => {
	const queue = {
		kind: "available",
		active: [],
		request: [
			{
				requestId: "first",
				lineUid: "a",
				status: "waiting-inputs",
			},
			{
				requestId: "second",
				lineUid: "a",
				status: "waiting-inputs",
			},
			{
				requestId: "third",
				lineUid: "b",
				status: "blocked-condition",
			},
		],
	} satisfies readItemDetailQueueFx.Result;
	expect(readItemLineStatusesFn(queue)).toEqual([
		{
			lineUid: "a",
			state: "waiting-inputs",
			queued: 2,
			requestId: "first",
		},
		{
			lineUid: "b",
			state: "waiting-start",
			queued: 1,
			requestId: "third",
		},
	]);
	expect(
		readItemLineStatusesFn({
			kind: "unavailable",
		}),
	).toEqual([]);
});
