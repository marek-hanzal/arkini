import type { PropsWithChildren } from "react";

import { EditorProjectForm } from "~/ui/project/editor/EditorProjectForm";

export const EditorProjectPage = ({ children }: PropsWithChildren) => (
	<EditorProjectForm>{children}</EditorProjectForm>
);
