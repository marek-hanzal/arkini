import { describe, expect, it } from "vitest";

import { readEditorBuildFailureFn } from "~/editor/build/fn/readEditorBuildFailureFn";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { GameValidationError } from "~/engine/validation/error/GameValidationError";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";

const diagnostic = {
	code: DiagnosticCodeEnumSchema.enum.ResourceMissing,
	severity: "error" as const,
	message: "Resource item-water is missing.",
	path: [
		"items",
		"water",
		"asset",
		"default",
		0,
	],
	source: "items/simple/water.json",
	resourceId: "item-water",
};

describe("readEditorBuildFailureFn", () => {
	it("keeps validation diagnostics distinct from operational failures", () => {
		expect(
			readEditorBuildFailureFn(
				new GameValidationError({
					diagnostics: [
						diagnostic,
					],
				}),
			),
		).toEqual({
			type: "validation",
			diagnostics: [
				diagnostic,
			],
		});

		expect(
			readEditorBuildFailureFn(
				new EditorProjectRepositoryError({
					operation: "build-project",
					message: "Refresh the saved project and build again.",
				}),
			),
		).toEqual({
			type: "operational",
			detail: "Refresh the saved project and build again.",
		});
	});

	it("uses a safe fallback for unknown renderer failures", () => {
		expect(
			readEditorBuildFailureFn(
				new Error("ENOENT /Users/private/project/resources/secret.png"),
			),
		).toEqual({
			type: "operational",
			detail: "The Editor project could not be built because of an unknown error.",
		});
	});
});
