import { Effect } from "effect";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorProjectFormSchema } from "~/bridge/project/editor/EditorProjectFormSchema";
import { EditorProjectCompatibility } from "~/editor/version/EditorProjectCompatibility";
import { GridSizeSchema } from "~/engine/grid/schema/GridSizeSchema";
import { ToolbarSizeSchema } from "~/engine/meta/schema/ToolbarSizeSchema";

/** Preserves breaking size warnings when another draft invariant prevents full config parsing. */
export const analyzeEditorProjectStructuralCompatibilityFx = Effect.fn(
	"analyzeEditorProjectStructuralCompatibilityFx",
)((project: Pick<EditorProject, "config">, value: EditorProjectFormSchema.Type) =>
	Effect.sync(() => {
		const board = GridSizeSchema.safeParse(value.board);
		const inventory = GridSizeSchema.safeParse(value.inventory);
		const toolbarSize = ToolbarSizeSchema.safeParse(value.toolbarSize);
		if (!board.success || !inventory.success || !toolbarSize.success) return undefined;
		const compatibility = EditorProjectCompatibility.analyze(project.config, {
			...project.config,
			meta: {
				...project.config.meta,
				board: board.data,
				inventory: inventory.data,
				toolbarSize: toolbarSize.data,
			},
		});
		return compatibility.level === "major" ? compatibility : undefined;
	}),
);
