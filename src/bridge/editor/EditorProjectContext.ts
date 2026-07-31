import { createContext } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";

export const EditorProjectContext = createContext<EditorProject | undefined>(undefined);
