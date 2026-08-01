import { useContext } from "react";

import { EditorProjectContext } from "~/bridge/editor/EditorProjectContext";

/** Reads the editor project snapshot, including item changes staged for project Save. */
export const useEditorProject = () => {
	const project = useContext(EditorProjectContext);
	if (project === undefined) throw new Error("Editor project provider is missing.");
	return project;
};
