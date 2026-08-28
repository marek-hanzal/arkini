import { createContext } from "react";

import type { EditorProject } from "~/editor/EditorProject";

export interface EditorResourceUrlStore {
	readonly read: (resourceId: string) => string | undefined;
	readonly subscribe: (resourceId: string, listener: () => void) => () => void;
	readonly sync: (resources: EditorProject["resources"]) => void;
	readonly dispose: () => void;
}

/** Carries one project-scoped object-URL lifecycle owner to mounted preview consumers. */
export const EditorResourceUrlContext = createContext<EditorResourceUrlStore | undefined>(
	undefined,
);
