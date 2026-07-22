import { describe, expect, it } from "vitest";

import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";

describe("runtime enum schemas", () => {
	it("owns reusable runtime issue and drop-result vocabularies", () => {
		expect(RuntimeCheckIssueEnumSchema.parse(RuntimeCheckIssueEnumSchema.enum.ItemCharges)).toBe(
			RuntimeCheckIssueEnumSchema.enum.ItemCharges,
		);
		expect(DropItemResultKindEnumSchema.options).toEqual([
			DropItemResultKindEnumSchema.enum.Move,
			DropItemResultKindEnumSchema.enum.Swap,
			DropItemResultKindEnumSchema.enum.Merge,
			DropItemResultKindEnumSchema.enum.Ignored,
			DropItemResultKindEnumSchema.enum.Reject,
		]);
	});
});
