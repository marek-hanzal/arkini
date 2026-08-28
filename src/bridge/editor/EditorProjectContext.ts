import { createContext } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";

/** Carries the latest canonical repository snapshot through one mounted project route. */
export const EditorProjectContext = createContext<EditorProject | undefined>(undefined);
