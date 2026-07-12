import { describe, expect, it } from "vitest";

import { JobSchema } from "~/v1/job/schema/JobSchema";
import { JobLocationSchema } from "~/v1/location/schema/JobLocationSchema";

const job = {
	id: "job:test",
	ownerItemId: "runtime:forge",
	lineId: "line:forge:run",
	durationMs: 1_000,
	remainingMs: 1_000,
	revision: "revision:job",
};

describe("JobSchema", () => {
	it("accepts one active job and its reserved-item location", () => {
		expect(JobSchema.parse(job)).toEqual(job);
		expect(
			JobLocationSchema.parse({
				scope: "job",
				jobId: job.id,
			}),
		).toEqual({
			scope: "job",
			jobId: job.id,
		});
	});
});
