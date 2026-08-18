import { Effect } from "effect";

import type { EditorProject } from "../../src/editor/EditorProject";

/** Reads and formats one canonical item identity for MCP. */
export const readEditorMcpItemDetailTextFx = Effect.fn("readEditorMcpItemDetailTextFx")(
	(project: EditorProject, itemId: string) =>
		Effect.gen(function* () {
			const item = project.config.items[itemId];
			if (item === undefined)
				return yield* Effect.fail(
					new Error(`Item ${itemId} does not exist in the open project.`),
				);
			return [
				`Item: ${item.title}`,
				`ID: ${item.id}`,
				`UID: ${item.uid}`,
				`Type: ${item.type}`,
				"Description:",
				...item.description.split("\n").map((line) => `  ${line}`),
				`Storage: ${item.scope}`,
				`Stack capacity: ${item.maxStackSize}`,
				...(item.maxCount === undefined
					? []
					: [
							`Game limit: ${item.maxCount}`,
						]),
			].join("\n");
		}),
);
