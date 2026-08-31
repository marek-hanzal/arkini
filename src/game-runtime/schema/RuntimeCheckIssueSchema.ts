import { z } from "zod";

import { DeliveryTargetIssueSchema } from "~/production-delivery/schema/DeliveryTargetIssueSchema";
import { DuplicateJobIdIssueSchema } from "~/production-job/schema/DuplicateJobIdIssueSchema";
import { JobLineMissingIssueSchema } from "~/production-job/schema/JobLineMissingIssueSchema";
import { JobOwnerMissingIssueSchema } from "~/production-job/schema/JobOwnerMissingIssueSchema";
import { JobOwnerMultipleActiveIssueSchema } from "~/production-job/schema/JobOwnerMultipleActiveIssueSchema";
import { JobOwnerNotOnGridIssueSchema } from "~/production-job/schema/JobOwnerNotOnGridIssueSchema";
import { JobQueueExceededIssueSchema } from "~/production-job/schema/JobQueueExceededIssueSchema";
import { JobConsumedMaterialStateIssueSchema } from "~/production-job/schema/JobConsumedMaterialStateIssueSchema";
import { JobMaterialOrphanIssueSchema } from "~/production-job/schema/JobMaterialOrphanIssueSchema";
import { JobTimeInvalidIssueSchema } from "~/production-job/schema/JobTimeInvalidIssueSchema";
import { InputCapacityExceededIssueSchema } from "~/production-input/schema/check/InputCapacityExceededIssueSchema";
import { InputLineMissingIssueSchema } from "~/production-input/schema/check/InputLineMissingIssueSchema";
import { InputOwnerMissingIssueSchema } from "~/production-input/schema/check/InputOwnerMissingIssueSchema";
import { InputSelectorMismatchIssueSchema } from "~/production-input/schema/check/InputSelectorMismatchIssueSchema";
import { InputSlotInvalidIssueSchema } from "~/production-input/schema/check/InputSlotInvalidIssueSchema";
import { DuplicateItemIdIssueSchema } from "./DuplicateItemIdIssueSchema";
import { ItemMaxCountIssueSchema } from "./ItemMaxCountIssueSchema";
import { ItemChargesIssueSchema } from "./ItemChargesIssueSchema";
import { ItemStackSizeIssueSchema } from "./ItemStackSizeIssueSchema";
import { ItemTemporaryDurationIssueSchema } from "./ItemTemporaryDurationIssueSchema";
import { LocationOccupiedIssueSchema } from "./LocationOccupiedIssueSchema";
import { LocationOutOfBoundsIssueSchema } from "./LocationOutOfBoundsIssueSchema";
import { DefaultLineIssueSchema } from "~/production-line/schema/check/DefaultLineIssueSchema";
import { LineInputClosedIssueSchema } from "~/production-line/schema/check/LineInputClosedIssueSchema";
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
		DeliveryTargetIssueSchema,
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
