import { createContext, useContext } from "react";

import type { EditorProject } from "~/editor/EditorProject";

/** Carries the latest canonical repository snapshot through one mounted project route. */
export const EditorProjectContext = createContext<EditorProject | undefined>(undefined);

/** Reads the latest canonical editor project snapshot published by its repository owner. */
export const useEditorProject = () => {
	const project = useContext(EditorProjectContext);
	if (project === undefined) throw new Error("Editor project provider is missing.");
	return project;
};
