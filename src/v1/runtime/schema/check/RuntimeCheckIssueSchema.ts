import { z } from "zod";

import { DuplicateJobIdIssueSchema } from "~/v1/job/schema/DuplicateJobIdIssueSchema";
import { JobLineMissingIssueSchema } from "~/v1/job/schema/JobLineMissingIssueSchema";
import { JobOwnerMissingIssueSchema } from "~/v1/job/schema/JobOwnerMissingIssueSchema";
import { JobOwnerNotOnGridIssueSchema } from "~/v1/job/schema/JobOwnerNotOnGridIssueSchema";
import { JobQueueExceededIssueSchema } from "~/v1/job/schema/JobQueueExceededIssueSchema";
import { JobReservationMismatchIssueSchema } from "~/v1/job/schema/JobReservationMismatchIssueSchema";
import { JobReservationMissingIssueSchema } from "~/v1/job/schema/JobReservationMissingIssueSchema";
import { JobTimeInvalidIssueSchema } from "~/v1/job/schema/JobTimeInvalidIssueSchema";
import { InputCapacityExceededIssueSchema } from "~/v1/input/schema/check/InputCapacityExceededIssueSchema";
import { InputLineMissingIssueSchema } from "~/v1/input/schema/check/InputLineMissingIssueSchema";
import { InputOwnerMissingIssueSchema } from "~/v1/input/schema/check/InputOwnerMissingIssueSchema";
import { InputSelectorMismatchIssueSchema } from "~/v1/input/schema/check/InputSelectorMismatchIssueSchema";
import { InputSlotInvalidIssueSchema } from "~/v1/input/schema/check/InputSlotInvalidIssueSchema";
import { DuplicateItemIdIssueSchema } from "./DuplicateItemIdIssueSchema";
import { ItemMaxCountIssueSchema } from "./ItemMaxCountIssueSchema";
import { ItemStackSizeIssueSchema } from "./ItemStackSizeIssueSchema";
import { LocationOccupiedIssueSchema } from "./LocationOccupiedIssueSchema";
import { LocationOutOfBoundsIssueSchema } from "./LocationOutOfBoundsIssueSchema";
import { LocationScopeIssueSchema } from "./LocationScopeIssueSchema";

/**
 * One explicitly reported runtime invariant violation.
 */
export const RuntimeCheckIssueSchema = z
	.discriminatedUnion("type", [
		DuplicateJobIdIssueSchema,
		JobOwnerMissingIssueSchema,
		JobOwnerNotOnGridIssueSchema,
		JobLineMissingIssueSchema,
		JobQueueExceededIssueSchema,
		JobTimeInvalidIssueSchema,
		JobReservationMissingIssueSchema,
		JobReservationMismatchIssueSchema,
		DuplicateItemIdIssueSchema,
		ItemMaxCountIssueSchema,
		ItemStackSizeIssueSchema,
		InputOwnerMissingIssueSchema,
		InputLineMissingIssueSchema,
		InputSlotInvalidIssueSchema,
		InputSelectorMismatchIssueSchema,
		InputCapacityExceededIssueSchema,
		LocationOccupiedIssueSchema,
		LocationOutOfBoundsIssueSchema,
		LocationScopeIssueSchema,
	])
	.meta({
		id: "RuntimeCheckIssueSchema",
		description: "One explicitly reported runtime invariant violation.",
	});

export type RuntimeCheckIssueSchema = typeof RuntimeCheckIssueSchema;

export namespace RuntimeCheckIssueSchema {
	export type Type = z.infer<RuntimeCheckIssueSchema>;
}
