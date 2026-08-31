import { useAtomValue } from "@effect/atom-react";
import { Fragment, type PropsWithChildren } from "react";

import { EditorProjectReplacementEpochAtom } from "~/authoring-session/atom/EditorProjectReplacementEpochAtom";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";

/** Recreates project-bound renderer owners only after an explicit whole-project replacement. */
export const EditorProjectReplacementBoundary = ({ children }: PropsWithChildren) => {
	const project = useEditorProject();
	const replacementEpoch = useAtomValue(EditorProjectReplacementEpochAtom(project.projectId));
	return <Fragment key={`${project.projectId}:${replacementEpoch}`}>{children}</Fragment>;
};
