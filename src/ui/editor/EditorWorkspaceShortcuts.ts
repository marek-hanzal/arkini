import type { EditorWorkspaceId } from "~/ui/editor/useEditorActiveWorkspace";

export const EditorWorkspaceShortcuts = {
	assets: "Mod+Shift+A",
	board: "Mod+Shift+B",
	build: "Mod+Shift+U",
	chatgpt: "Mod+Shift+C",
	estimate: "Mod+Shift+E",
	flow: "Mod+Shift+F",
	items: "Mod+Shift+I",
	mcp: "Mod+Shift+M",
	notes: "Mod+Shift+N",
	project: "Mod+Shift+P",
	versions: "Mod+Shift+V",
} as const;

export const readEditorWorkspaceShortcut = (workspace: EditorWorkspaceId) =>
	EditorWorkspaceShortcuts[workspace];
