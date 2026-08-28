import { createContext } from "react";

import type { EditorProject } from "~/editor/EditorProject";

/** Carries the latest canonical repository snapshot through one mounted project route. */
export const EditorProjectContext = createContext<EditorProject | undefined>(undefined);
