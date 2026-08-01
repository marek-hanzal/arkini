import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import { useLayoutEffect, useMemo, type PropsWithChildren } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { EditorProjectContext } from "~/bridge/editor/EditorProjectContext";
import { EditorProjectDraftAtom } from "~/bridge/editor/EditorProjectDraftAtom";
import { openEditorProjectSessionAtom } from "~/bridge/editor/openEditorProjectSessionAtom";

/** Publishes each loader epoch and exposes the canonical project overlaid with staged items. */
export const EditorProjectProvider = ({
	children,
	expectedRevision,
	loaded,
}: PropsWithChildren<{
	readonly expectedRevision: string | undefined;
	readonly loaded: EditorProject;
}>) => {
	const [project, publish] = useAtom(EditorProjectAtom(loaded.projectId));
	const draftAtom = EditorProjectDraftAtom(loaded.projectId);
	const staged = useAtomValue(draftAtom);
	const openProjectSession = useAtomSet(openEditorProjectSessionAtom);
	useLayoutEffect(() => {
		openProjectSession(loaded.projectId);
	}, [
		loaded.projectId,
		openProjectSession,
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
		for (const item of Object.values(staged)) {
			const current = Object.entries(items).find(
				([, candidate]) => candidate.uid === item.uid,
			);
			if (current !== undefined && current[0] !== item.id) delete items[current[0]];
			items[item.id] = item;
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
