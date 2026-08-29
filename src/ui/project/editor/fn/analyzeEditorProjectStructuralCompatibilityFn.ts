import type { EditorProject } from "~/editor/EditorProject";
import type { EditorProjectFormSchema } from "~/ui/project/editor/EditorProjectFormSchema";
import { analyzeEditorProjectCompatibilityFn } from "~/project-version/fn/analyzeEditorProjectCompatibilityFn";
import { SizeSchema } from "~/engine/grid/schema/SizeSchema";
import { ToolbarSizeSchema } from "~/engine/meta/schema/ToolbarSizeSchema";

/** Preserves breaking size warnings when another draft invariant prevents full config parsing. */
export const analyzeEditorProjectStructuralCompatibilityFn = (
	project: Pick<EditorProject, "config">,
	value: EditorProjectFormSchema.Type,
) => {
	const board = SizeSchema.safeParse(value.board);
	const inventory = SizeSchema.safeParse(value.inventory);
	const toolbarSize = ToolbarSizeSchema.safeParse(value.toolbarSize);
	if (!board.success || !inventory.success || !toolbarSize.success) return undefined;
	const compatibility = analyzeEditorProjectCompatibilityFn(project.config, {
		...project.config,
		meta: {
			...project.config.meta,
			board: board.data,
			inventory: inventory.data,
			toolbarSize: toolbarSize.data,
		},
	});
	return compatibility.result === "major" ? compatibility : undefined;
};
