import { updateEditorMcpProjectContextFx } from "~/bridge/editor-mcp/updateEditorMcpProjectContextFx";

export const setEditorMcpProjectContextFx = (projectId: unknown) =>
	updateEditorMcpProjectContextFx(projectId, window.arkini.editorMcp.setProjectContext);
