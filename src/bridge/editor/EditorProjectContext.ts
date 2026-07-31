import { createContext } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";

/** Carries the last successfully persisted and compiled editor project. */
export const EditorProjectContext = createContext<EditorProject | undefined>(undefined);
