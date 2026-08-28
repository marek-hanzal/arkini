import { Effect } from "effect";

import type { EditorProject } from "~/editor/EditorProject";
import { validateGameConfigFx } from "~/engine/validation/fx/validateGameConfigFx";
import { validateGameResourcesFx } from "~/engine/validation/rule/validateGameResourcesFx";

/** Prints canonical saved-project semantic and resource-reference diagnostics. */
export const readProjectValidationTextFx = Effect.fn("readProjectValidationTextFx")(function* (
	project: EditorProject,
) {
	const source = `editor:${project.projectId}`;
	const provenance = {
		meta: source,
		resources: source,
		start: source,
		items: Object.fromEntries(
			Object.keys(project.config.items).map((id) => [
				id,
				source,
			]),
		),
	};
	const diagnostics = (yield* Effect.all([
		validateGameConfigFx({
			config: project.config,
			provenance,
		}),
		validateGameResourcesFx({
			config: project.config,
			provenance,
			resources: project.resources.map(({ id }) => ({
				id,
				mime: "image/png" as const,
				path: `${source}/resources/${id}.png`,
			})),
		}),
	])).flat();
	const errors = diagnostics.filter(({ severity }) => severity === "error").length;
	const warnings = diagnostics.length - errors;
	const lines = [
		"Project validation",
		`Project ID: ${project.projectId}`,
		`Revision: ${project.revision}`,
		`Errors: ${errors}`,
		`Warnings: ${warnings}`,
	];
	for (const diagnostic of diagnostics) {
		lines.push(
			`- [${diagnostic.severity}] ${diagnostic.code}`,
			`  Path: ${diagnostic.path.join(".")}`,
			`  Message: ${diagnostic.message}`,
		);
		if (diagnostic.source !== undefined) lines.push(`  Source: ${diagnostic.source}`);
	}
	if (diagnostics.length === 0) lines.push("No diagnostics.");
	return lines.join("\n");
});
