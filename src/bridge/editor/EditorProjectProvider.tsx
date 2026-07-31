import { RegistryContext, useAtom, useAtomValue } from "@effect/atom-react";
import { useContext, useLayoutEffect, useMemo, type PropsWithChildren } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { EditorProjectContext } from "~/bridge/editor/EditorProjectContext";
import { EditorProjectDraftAtom } from "~/bridge/editor/EditorProjectDraftAtom";
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
	const registry = useContext(RegistryContext);
	const [project, publish] = useAtom(EditorProjectAtom(loaded.projectId));
	const staged = useAtomValue(EditorProjectDraftAtom(loaded.projectId));
	useLayoutEffect(() => {
		openEditorProjectSession(loaded.projectId, registry);
	}, [
		loaded.projectId,
		registry,
	]);
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
	const draft = useMemo(() => {
		if (snapshot.config === undefined || Object.keys(staged).length === 0) return snapshot;
		const items = {
			...snapshot.config.items,
		};
		for (const change of Object.values(staged)) {
			if (change.sourceItemId !== undefined && change.sourceItemId !== change.item.id) {
				delete items[change.sourceItemId];
			}
			items[change.item.id] = change.item;
		}
		return {
			...snapshot,
			config: {
				...snapshot.config,
				items,
			},
		};
	}, [
		snapshot,
		staged,
	]);
	return <EditorProjectContext value={draft}>{children}</EditorProjectContext>;
};
