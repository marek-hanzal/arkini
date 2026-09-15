import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";

/** One material input retains stored items while its line has an active job. */
export const LineInputClosedIssueSchema = z
	.object({
		ownerItemId: IdSchema.describe("The runtime item that owns the closed line input."),
		lineId: IdSchema.describe("The running line whose input is closed."),
		inputIndex: NonNegativeIntegerSchema.describe("The zero-based closed input position."),
		itemIds: z
			.array(IdSchema)
			.describe("The stored runtime items illegally retained by the closed input."),
		type: RuntimeCheckIssueEnumSchema.extract([
			"LineInputClosed",
		]),
	})
	.strict()
	.meta({
		id: "LineInputClosedIssueSchema",
		description: "One running line input still owns stored items.",
	});

export type LineInputClosedIssueSchema = typeof LineInputClosedIssueSchema;

export namespace LineInputClosedIssueSchema {
	export type Type = z.infer<LineInputClosedIssueSchema>;
}
