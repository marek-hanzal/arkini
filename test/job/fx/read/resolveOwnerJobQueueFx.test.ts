import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { resolveOwnerJobQueueFx } from "~/v1/job/fx/read/resolveOwnerJobQueueFx";
import type { JobSchema } from "~/v1/job/schema/JobSchema";

const jobs = [
	{
		id: "job:first",
		ownerItemId: "runtime:forge",
		lineId: "line:forge:run",
		startedAtMs: 1_000,
		dueAtMs: 2_000,
		revision: "revision:first",
	},
	{
		id: "job:second",
		ownerItemId: "runtime:forge",
		lineId: "line:forge:run",
		startedAtMs: 2_000,
		dueAtMs: 3_000,
		revision: "revision:second",
	},
	{
		id: "job:other",
		ownerItemId: "runtime:other",
		lineId: "line:other:run",
		startedAtMs: 1_000,
		dueAtMs: 2_000,
		revision: "revision:other",
	},
] satisfies JobSchema.Type[];

describe("resolveOwnerJobQueueFx", () => {
	it("derives queued, running, and ready states without mutating jobs", () => {
		const beforeStart = Effect.runSync(
			resolveOwnerJobQueueFx({
				jobs,
				ownerItemId: "runtime:forge",
				nowMs: 500,
			}),
		);
		const duringFirst = Effect.runSync(
			resolveOwnerJobQueueFx({
				jobs,
				ownerItemId: "runtime:forge",
				nowMs: 1_500,
			}),
		);
		const afterBoth = Effect.runSync(
			resolveOwnerJobQueueFx({
				jobs,
				ownerItemId: "runtime:forge",
				nowMs: 3_000,
			}),
		);

		expect(beforeStart.map(({ status }) => status)).toEqual([
			"queued",
			"queued",
		]);
		expect(duringFirst.map(({ status }) => status)).toEqual([
			"running",
			"queued",
		]);
		expect(afterBoth.map(({ status }) => status)).toEqual([
			"ready",
			"ready",
		]);
		expect(duringFirst[1]).toMatchObject({
			queueIndex: 1,
			previousJobId: "job:first",
		});
		expect(jobs[0].startedAtMs).toBe(1_000);
	});
});
