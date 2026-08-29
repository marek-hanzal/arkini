import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useMemo, useState } from "react";

import { deleteEditorAssetFx } from "~/asset-authoring/session/deleteEditorAssetFx";
import { EditorProjectRepository } from "~/project-authoring/repository/EditorProjectRepository";
import { useEditorProject } from "~/authoring-session/useEditorProject";
import { RendererRuntime } from "~/application-runtime/RendererRuntime";
import {
	readEditorAssetDeleteBlockersFn,
	type EditorAssetDeleteBlocker,
} from "~/asset-authoring/domain/fn/readEditorAssetDeleteBlockersFn";
import { readSettledAsyncResultErrorFx } from "~/ui/reactivity/readSettledAsyncResultErrorFx";

interface DeleteEditorAssetCommandProps {
	readonly expectedRevision: number;
	readonly resourceId: string;
}

const deleteEditorAssetCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((props: DeleteEditorAssetCommandProps) =>
				deleteEditorAssetFx({
					...props,
					projectId,
				}).pipe(Effect.provideService(EditorProjectRepository, repository)),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);

interface UseEditorAssetDeleteControllerProps {
	readonly filter: "all" | "unused";
	readonly query: string;
	readonly resourceId: string;
}

interface UseEditorAssetDeleteControllerOutput {
	readonly blockers: ReadonlyArray<EditorAssetDeleteBlocker>;
	readonly cancel: () => void;
	readonly confirm: () => Promise<void>;
	readonly confirming: boolean;
	readonly deleting: boolean;
	readonly error: unknown;
	readonly open: () => void;
	readonly project: ReturnType<typeof useEditorProject>;
}

/** Owns asset-delete eligibility, confirmation, persistence, and terminal navigation. */
export const useEditorAssetDeleteController = ({
	filter,
	query,
	resourceId,
}: UseEditorAssetDeleteControllerProps): UseEditorAssetDeleteControllerOutput => {
	const project = useEditorProject();
	const navigate = useNavigate();
	const commandAtom = deleteEditorAssetCommandAtom(project.projectId);
	const result = useAtomValue(commandAtom);
	const remove = useAtomSet(commandAtom, {
		mode: "promise",
	});
	const [confirming, setConfirming] = useState(false);
	const blockers = useMemo(
		() =>
			readEditorAssetDeleteBlockersFn({
				config: project.config,
				resourceId,
			}),
		[
			project.config,
			resourceId,
		],
	);
	const cancel = useCallback(() => {
		if (!result.waiting) setConfirming(false);
	}, [
		result.waiting,
	]);
	const open = useCallback(() => {
		if (blockers.length === 0 && !result.waiting) setConfirming(true);
	}, [
		blockers.length,
		result.waiting,
	]);
	const confirm = useCallback(async () => {
		if (!confirming || blockers.length > 0 || result.waiting) return;
		try {
			await remove({
				expectedRevision: project.revision,
				resourceId,
			});
			await navigate({
				to: "/editor/$projectId/assets",
				params: {
					projectId: project.projectId,
				},
				search: {
					filter,
					query,
				},
				replace: true,
			});
		} catch {
			// The settled command error remains visible in the confirmation dialog.
		}
	}, [
		blockers.length,
		confirming,
		filter,
		navigate,
		project.projectId,
		project.revision,
		query,
		remove,
		resourceId,
		result.waiting,
	]);

	return {
		blockers,
		cancel,
		confirm,
		confirming,
		deleting: result.waiting,
		error: RendererRuntime.runSync(readSettledAsyncResultErrorFx(result)),
		open,
		project,
	};
};
