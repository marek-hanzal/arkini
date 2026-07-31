import { useContext } from "react";

import { EditorProjectContext } from "~/bridge/editor/EditorProjectContext";

/** Reads the canonical project snapshot published once by the editor project route. */
export const useEditorProject = () => {
	const project = useContext(EditorProjectContext);
	if (project === undefined) throw new Error("Editor project provider is missing.");
	return project;
};
