import { describe, expect, it } from "vitest";

import {
	APPLICATION_LOG_BODY_MAX_LENGTH,
	ApplicationLogRecordSchema,
} from "~electron/contract/diagnostics/ApplicationLogRecord";
import { formatApplicationDiagnosticTextFn } from "~/application-diagnostics/fn/formatApplicationDiagnosticTextFn";
import { formatDiagnosticValueTextFn } from "~/application-diagnostics/fn/formatDiagnosticValueTextFn";

describe("formatDiagnosticValueTextFn", () => {
	it("preserves local evidence for application diagnostics", () => {
		const path = "/Users/developer/Project/arkini/editor/project.json";
		const text = formatDiagnosticValueTextFn({
			value: {
				cause: {
					message: "Project creation failed",
					path,
				},
			},
			redactPaths: false,
		});

		expect(text).toContain("Project creation failed");
		expect(text).toContain(path);
		expect(text).not.toContain("{");
	});

	it("keeps expanded renderer failures inside the application IPC contract", () => {
		const body = formatApplicationDiagnosticTextFn({
			value: Object.fromEntries(
				Array.from(
					{
						length: 50,
					},
					(_, index) => [
						`failure-${index}`,
						"\n".repeat(450),
					],
				),
			),
			prefix: "Boundary: renderer root",
		});

		expect(body.length).toBeLessThanOrEqual(APPLICATION_LOG_BODY_MAX_LENGTH);
		expect(body).toContain("diagnostic text truncated during formatting");
		expect(() =>
			ApplicationLogRecordSchema.parse({
				level: "fatal",
				message: "Renderer entered the fatal boundary",
				body,
			}),
		).not.toThrow();
	});

	it("marks truncation performed while normalizing unknown failures", () => {
		const body = formatApplicationDiagnosticTextFn({
			value: {
				message: "x".repeat(100_000),
			},
		});

		expect(body).toContain("diagnostic value truncated during normalization");
		expect(body.length).toBeLessThanOrEqual(APPLICATION_LOG_BODY_MAX_LENGTH);
	});
});
