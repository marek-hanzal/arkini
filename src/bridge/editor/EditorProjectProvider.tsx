import { useAtom } from "@effect/atom-react";
import { useLayoutEffect, type PropsWithChildren } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { EditorProjectContext } from "~/bridge/editor/EditorProjectContext";
import { openEditorProjectSession } from "~/bridge/editor/EditorProjectSession";

/** Publishes each route-loader epoch once and exposes the canonical project snapshot. */
export const EditorProjectProvider = ({
	children,
	expectedRevision,
	loaded,
}: PropsWithChildren<{
	readonly expectedRevision: string | undefined;
	readonly loaded: EditorProject;
}>) => {
	const [project, publish] = useAtom(EditorProjectAtom(loaded.projectId));
	useLayoutEffect(() => {
		openEditorProjectSession(loaded.projectId);
	}, [loaded.projectId]);
	useLayoutEffect(() => {
		publish({
			action: "refresh",
			expectedRevision,
			project: loaded,
		});
	}, [
		expectedRevision,
		loaded,
		publish,
	]);
	const snapshot = project ?? loaded;
	return <EditorProjectContext value={snapshot}>{children}</EditorProjectContext>;
};
