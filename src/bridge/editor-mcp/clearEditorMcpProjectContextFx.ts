import { updateEditorMcpProjectContextFx } from "~/bridge/editor-mcp/updateEditorMcpProjectContextFx";

export const clearEditorMcpProjectContextFx = (projectId: unknown) =>
	updateEditorMcpProjectContextFx(projectId, window.arkini.editorMcp.clearProjectContext);
