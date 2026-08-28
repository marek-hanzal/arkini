import type { EditorMcpSectionId } from "~/ui/editor-mcp/EditorMcpSections";
import { EditorMcp } from "~/ui/editor-mcp/EditorMcp";

export const EditorMcpPage = ({ section }: { readonly section: EditorMcpSectionId }) => (
	<EditorMcp section={section} />
);
