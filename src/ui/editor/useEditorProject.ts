import { useContext } from "react";

import { EditorProjectContext } from "~/ui/editor/EditorProjectContext";

/** Reads the latest canonical editor project snapshot published by its repository owner. */
export const useEditorProject = () => {
	const project = useContext(EditorProjectContext);
	if (project === undefined) throw new Error("Editor project provider is missing.");
	return project;
};
