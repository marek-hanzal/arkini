import { Effect } from "effect";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorProjectFormSchema } from "~/bridge/project/editor/EditorProjectFormSchema";
import { analyzeEditorProjectCompatibilityFx } from "~/editor/version/analyzeEditorProjectCompatibilityFx";
import { GridSizeSchema } from "~/engine/grid/schema/GridSizeSchema";
import { ToolbarSizeSchema } from "~/engine/meta/schema/ToolbarSizeSchema";

/** Preserves breaking size warnings when another draft invariant prevents full config parsing. */
export const analyzeEditorProjectStructuralCompatibilityFx = Effect.fn(
	"analyzeEditorProjectStructuralCompatibilityFx",
)(function* (project: Pick<EditorProject, "config">, value: EditorProjectFormSchema.Type) {
	const board = GridSizeSchema.safeParse(value.board);
	const inventory = GridSizeSchema.safeParse(value.inventory);
	const toolbarSize = ToolbarSizeSchema.safeParse(value.toolbarSize);
	if (!board.success || !inventory.success || !toolbarSize.success) return undefined;
	const compatibility = yield* analyzeEditorProjectCompatibilityFx(project.config, {
		...project.config,
		meta: {
			...project.config.meta,
			board: board.data,
			inventory: inventory.data,
			toolbarSize: toolbarSize.data,
		},
	});
	return compatibility.result === "major" ? compatibility : undefined;
});
