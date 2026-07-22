import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";

/** One zero-capacity input retains buffered items while its line has an active job. */
export const LineInputClosedIssueSchema = z
	.object({
		ownerItemId: IdSchema.describe("The runtime item that owns the closed line input."),
		lineId: IdSchema.describe("The running line whose input is closed."),
		inputIndex: NonNegativeIntegerSchema.describe("The zero-based closed input position."),
		itemIds: z
			.array(IdSchema)
			.describe("The buffered runtime items illegally retained by the closed input."),
		type: RuntimeCheckIssueEnumSchema.extract([
			RuntimeCheckIssueEnumSchema.enum.LineInputClosed,
		]),
	})
	.strict()
	.meta({
		id: "LineInputClosedIssueSchema",
		description: "One running zero-capacity line input still owns buffered items.",
	});

export type LineInputClosedIssueSchema = typeof LineInputClosedIssueSchema;

export namespace LineInputClosedIssueSchema {
	export type Type = z.infer<LineInputClosedIssueSchema>;
}
