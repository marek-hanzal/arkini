import { z } from "zod";

import { DuplicateJobIdIssueSchema } from "~/engine/job/schema/DuplicateJobIdIssueSchema";
import { JobLineMissingIssueSchema } from "~/engine/job/schema/JobLineMissingIssueSchema";
import { JobOwnerMissingIssueSchema } from "~/engine/job/schema/JobOwnerMissingIssueSchema";
import { JobOwnerMultipleActiveIssueSchema } from "~/engine/job/schema/JobOwnerMultipleActiveIssueSchema";
import { JobOwnerNotOnGridIssueSchema } from "~/engine/job/schema/JobOwnerNotOnGridIssueSchema";
import { JobQueueExceededIssueSchema } from "~/engine/job/schema/JobQueueExceededIssueSchema";
import { JobConsumedMaterialStateIssueSchema } from "~/engine/job/schema/JobConsumedMaterialStateIssueSchema";
import { JobMaterialOrphanIssueSchema } from "~/engine/job/schema/JobMaterialOrphanIssueSchema";
import { JobTimeInvalidIssueSchema } from "~/engine/job/schema/JobTimeInvalidIssueSchema";
import { InputCapacityExceededIssueSchema } from "~/engine/input/schema/check/InputCapacityExceededIssueSchema";
import { InputLineMissingIssueSchema } from "~/engine/input/schema/check/InputLineMissingIssueSchema";
import { InputOwnerMissingIssueSchema } from "~/engine/input/schema/check/InputOwnerMissingIssueSchema";
import { InputSelectorMismatchIssueSchema } from "~/engine/input/schema/check/InputSelectorMismatchIssueSchema";
import { InputSlotInvalidIssueSchema } from "~/engine/input/schema/check/InputSlotInvalidIssueSchema";
import { DuplicateItemIdIssueSchema } from "./DuplicateItemIdIssueSchema";
import { ItemMaxCountIssueSchema } from "./ItemMaxCountIssueSchema";
import { ItemChargesIssueSchema } from "./ItemChargesIssueSchema";
import { ItemStackSizeIssueSchema } from "./ItemStackSizeIssueSchema";
import { ItemTemporaryDurationIssueSchema } from "./ItemTemporaryDurationIssueSchema";
import { LocationOccupiedIssueSchema } from "./LocationOccupiedIssueSchema";
import { LocationOutOfBoundsIssueSchema } from "./LocationOutOfBoundsIssueSchema";
import { DefaultLineIssueSchema } from "~/engine/line/schema/check/DefaultLineIssueSchema";
import { LineInputClosedIssueSchema } from "~/engine/line/schema/check/LineInputClosedIssueSchema";
import { LocationScopeIssueSchema } from "./LocationScopeIssueSchema";

/**
 * One explicitly reported runtime invariant violation.
 */
export const RuntimeCheckIssueSchema = z
	.discriminatedUnion("type", [
		DuplicateJobIdIssueSchema,
		JobOwnerMissingIssueSchema,
		JobOwnerMultipleActiveIssueSchema,
		JobOwnerNotOnGridIssueSchema,
		JobLineMissingIssueSchema,
		JobQueueExceededIssueSchema,
		JobTimeInvalidIssueSchema,
		JobMaterialOrphanIssueSchema,
		JobConsumedMaterialStateIssueSchema,
		DuplicateItemIdIssueSchema,
		ItemMaxCountIssueSchema,
		ItemChargesIssueSchema,
		ItemStackSizeIssueSchema,
		ItemTemporaryDurationIssueSchema,
		InputOwnerMissingIssueSchema,
		InputLineMissingIssueSchema,
		InputSlotInvalidIssueSchema,
		InputSelectorMismatchIssueSchema,
		InputCapacityExceededIssueSchema,
		DefaultLineIssueSchema,
		LineInputClosedIssueSchema,
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
