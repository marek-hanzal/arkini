import { describe, expect, it } from "vitest";

import { JobSchema } from "~/v1/job/schema/JobSchema";
import { JobLocationSchema } from "~/v1/location/schema/JobLocationSchema";

const job = {
	id: "job:test",
	ownerItemId: "runtime:forge",
	lineId: "line:forge:run",
	startedAtMs: 1_000,
	dueAtMs: 2_000,
	revision: "revision:job",
};

describe("JobSchema", () => {
	it("accepts one active job and its reserved-item location", () => {
		expect(JobSchema.parse(job)).toEqual(job);
		expect(
			JobLocationSchema.parse({
				scope: "job",
				jobId: job.id,
				returnLocation: {
					scope: "input",
					ownerItemId: job.ownerItemId,
					lineId: job.lineId,
					inputIndex: 1,
					returnLocation: {
						scope: "board",
						position: {
							x: 2,
							y: 0,
						},
					},
				},
			}),
		).toMatchObject({
			scope: "job",
			jobId: job.id,
		});
	});
});
