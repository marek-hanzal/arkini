import { expect, it } from "vitest";

import { readItemLineStatusesFn } from "~/item-detail-read/fn/readItemLineStatusesFn";
import type { readItemDetailQueueFx } from "~/item-detail-read/fx/readItemDetailQueueFx";

it("counts only each line's pending requests and keeps the active state ahead of its queue", () => {
	const queue = {
		kind: "available",
		itemId: "owner",
		capacity: 8,
		canClearQueue: true,
		active: [
			{
				jobId: "job",
				lineId: "a",
				title: "A",
				status: "running",
				durationMs: 1000,
				remainingMs: 900,
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
			title: lineId,
			status: "blocked-active" as const,
		})),
	} satisfies readItemDetailQueueFx.Result;
	const expected = [
		{
			lineId: "a",
			state: "running",
			queued: 2,
		},
		{
			lineId: "b",
			state: "queued",
			queued: 3,
		},
	];
	expect(readItemLineStatusesFn(queue)).toEqual(expected);
	expect(
		readItemLineStatusesFn({
			...queue,
			active: [
				{
					...queue.active[0]!,
					remainingMs: 400,
				},
			],
		}),
	).toEqual(expected);
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
		queued: 2,
	});
});

it("distinguishes missing input from other start blockers without claiming that queued work is running", () => {
	const queue = {
		kind: "available",
		itemId: "owner",
		capacity: 4,
		canClearQueue: true,
		active: [],
		request: [
			{
				requestId: "first",
				lineId: "a",
				title: "A",
				status: "waiting-inputs",
			},
			{
				requestId: "second",
				lineId: "a",
				title: "A",
				status: "waiting-inputs",
			},
			{
				requestId: "third",
				lineId: "b",
				title: "B",
				status: "blocked-condition",
			},
		],
	} satisfies readItemDetailQueueFx.Result;
	expect(readItemLineStatusesFn(queue)).toEqual([
		{
			lineId: "a",
			state: "waiting-inputs",
			queued: 2,
		},
		{
			lineId: "b",
			state: "waiting-start",
			queued: 1,
		},
	]);
	expect(
		readItemLineStatusesFn({
			kind: "unavailable",
		}),
	).toEqual([]);
});
