import { Effect } from "effect";

import type { EditorProject } from "~/editor/EditorProject";

/** Formats item-type counts for the MCP metadata tool. */
export const readEditorMcpItemMetaTextFx = Effect.fn("readEditorMcpItemMetaTextFx")(
	(project: EditorProject) =>
		Effect.sync(() => {
			const counts = new Map<string, number>();
			for (const item of Object.values(project.config.items))
				counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
			return [
				`Total: ${Object.keys(project.config.items).length}`,
				...[
					...counts.entries(),
				]
					.sort(([left], [right]) => left.localeCompare(right))
					.map(([type, count]) => `${type}: ${count}`),
			].join("\n");
		}),
);
