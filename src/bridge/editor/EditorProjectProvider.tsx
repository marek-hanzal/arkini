import { useAtom } from "@effect/atom-react";
import { useLayoutEffect, type PropsWithChildren } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { EditorProjectContext } from "~/bridge/editor/EditorProjectContext";

/** Publishes one committed repository snapshot to the mounted editor tree. */
export const EditorProjectProvider = ({
	children,
	loaded,
}: PropsWithChildren<{
	readonly loaded: EditorProject;
}>) => {
	const [project, publish] = useAtom(EditorProjectAtom(loaded.projectId));
	useLayoutEffect(() => {
		publish({
			project: loaded,
		});
	}, [
		loaded,
		publish,
	]);
	return <EditorProjectContext value={project ?? loaded}>{children}</EditorProjectContext>;
};
