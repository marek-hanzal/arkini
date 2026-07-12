import { Effect } from "effect";
import type { JobSchema } from "~/v1/job/schema/JobSchema";
import { createRevisionFx } from "~/v1/revision/fx/createRevisionFx";
export const reviseJobFx = <Job extends JobSchema.Type>(job: Job) =>
	createRevisionFx().pipe(
		Effect.map(
			(revision) =>
				({
					...job,
					revision,
				}) as Job,
		),
		Effect.withSpan("reviseJobFx"),
	);
