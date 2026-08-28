import { Effect } from "effect";

import { EditorMcpSectionIds, type EditorMcpSectionId } from "~/ui/editor-mcp/EditorMcpSections";

export const parseEditorMcpSectionIdFx = Effect.fn("parseEditorMcpSectionIdFx")(
	(candidate: string): Effect.Effect<EditorMcpSectionId, Error> => {
		const section = EditorMcpSectionIds.find((id) => id === candidate);
		return section === undefined
			? Effect.fail(new Error("Unknown MCP section."))
			: Effect.succeed(section);
	},
);
