import { Fragment, type PropsWithChildren } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";

/** Recreates every project-bound renderer owner after canonical project replacement. */
export const EditorProjectRevisionBoundary = ({ children }: PropsWithChildren) => {
	const project = useEditorProject();
	return <Fragment key={`${project.projectId}:${project.revision}`}>{children}</Fragment>;
};
