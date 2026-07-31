import { createContext } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";

/** Carries only the last canonical compiled project; staged changes live separately. */
export const EditorProjectContext = createContext<EditorProject | undefined>(undefined);
