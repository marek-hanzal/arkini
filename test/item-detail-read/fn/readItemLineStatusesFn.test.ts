import { expect, it } from "vitest";

import { readItemLineStatusesFn } from "~/item-detail-read/fn/readItemLineStatusesFn";
import type { readItemDetailQueueFx } from "~/item-detail-read/fx/readItemDetailQueueFx";

it("counts only each line's pending requests and keeps the active state ahead of its queue", () => {
	const queue = {
		kind: "available",
		active: [
			{
				jobId: "job",
				lineId: "a",
				status: "running",
			},
		],
		request: [
			"a",
			"b",
			"a",
			"b",
			"b",
		].map((lineId, index) => ({
			requestId: `request:${index}`,
			lineId,
			status: "blocked-active" as const,
		})),
	} satisfies readItemDetailQueueFx.Result;
	const expected = [
		{
			lineId: "a",
			state: "running",
			jobId: "job",
			queued: 2,
			requestId: "request:0",
		},
		{
			lineId: "b",
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
					status: "awaiting-output",
				},
			],
		})[0],
	).toEqual({
		lineId: "a",
		state: "awaiting-output",
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
				lineId: "a",
				status: "waiting-inputs",
			},
			{
				requestId: "second",
				lineId: "a",
				status: "waiting-inputs",
			},
			{
				requestId: "third",
				lineId: "b",
				status: "blocked-condition",
			},
		],
	} satisfies readItemDetailQueueFx.Result;
	expect(readItemLineStatusesFn(queue)).toEqual([
		{
			lineId: "a",
			state: "waiting-inputs",
			queued: 2,
			requestId: "first",
		},
		{
			lineId: "b",
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
