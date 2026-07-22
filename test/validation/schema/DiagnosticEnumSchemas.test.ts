import { describe, expect, it } from "vitest";

import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

describe("diagnostic enum schemas", () => {
	it("owns diagnostic code and severity vocabularies", () => {
		expect(DiagnosticSeverityEnumSchema.options).toEqual([
			DiagnosticSeverityEnumSchema.enum.Error,
			DiagnosticSeverityEnumSchema.enum.Warning,
		]);
		expect(
			DiagnosticCodeEnumSchema.parse(DiagnosticCodeEnumSchema.enum.ConfigMissingReference),
		).toBe(DiagnosticCodeEnumSchema.enum.ConfigMissingReference);
	});
});
