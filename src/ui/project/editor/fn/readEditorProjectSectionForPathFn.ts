import type { EditorProjectSectionId } from "~/ui/project/editor/EditorProjectSections";

/** Maps one Project form issue path to the routed section that owns it. */
export const readEditorProjectSectionForPathFn = (
	path: ReadonlyArray<PropertyKey>,
): EditorProjectSectionId => {
	const [head, second] = path;
	if (head === "hero" || head === "avatars") return "appearance";
	if (head === "board" || (head === "start" && second === "board")) return "board";
	if (head === "toolbarSize" || (head === "start" && second === "toolbar")) return "toolbar";
	if (head === "inventory" || (head === "start" && second === "inventory")) return "inventory";
	return "general";
};
