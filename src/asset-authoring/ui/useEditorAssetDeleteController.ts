import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useMemo, useState } from "react";

import { deleteEditorAssetFx } from "~/asset-authoring/fx/deleteEditorAssetFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { readEditorAssetDeleteBlockersFn } from "~/asset-authoring/fn/readEditorAssetDeleteBlockersFn";
import type { readGameResourceUsagesFn } from "~/game-config-resource/fn/readGameResourceUsagesFn";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import type { Project } from "~/project-authoring/type/Project";

interface DeleteEditorAssetCommandProps {
	readonly expectedRevision: number;
	readonly resourceId: string;
}

const deleteEditorAssetCommandAtom = RendererRuntime.runSync(
	Effect.map(ProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((props: DeleteEditorAssetCommandProps) =>
				deleteEditorAssetFx({
					...props,
					projectId,
				}).pipe(Effect.provideService(ProjectRepository, repository)),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);

export namespace useEditorAssetDeleteController {
	export interface Props {
		readonly filter: "all" | "unused";
		readonly query: string;
		readonly resourceId: string;
	}

	export interface Output {
		readonly blockers: ReadonlyArray<readGameResourceUsagesFn.Usage>;
		readonly cancelFn: () => void;
		readonly confirmFn: () => Promise<void>;
		readonly confirming: boolean;
		readonly deleting: boolean;
		readonly error: unknown;
		readonly openFn: () => void;
		readonly project: Project;
	}
}

/** Owns asset-delete eligibility, confirmation, persistence, and terminal navigation. */
export const useEditorAssetDeleteController = ({
	filter,
	query,
	resourceId,
}: useEditorAssetDeleteController.Props): useEditorAssetDeleteController.Output => {
	const project = useEditorProject();
	const navigateFn = useNavigate();
	const commandAtom = deleteEditorAssetCommandAtom(project.projectId);
	const result = useAtomValue(commandAtom);
	const removeFn = useAtomSet(commandAtom, {
		mode: "promise",
	});
	const [confirming, setConfirmingFn] = useState(false);
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
	const cancelFn = useCallback(() => {
		if (!result.waiting) setConfirmingFn(false);
	}, [
		result.waiting,
	]);
	const openFn = useCallback(() => {
		if (blockers.length === 0 && !result.waiting) setConfirmingFn(true);
	}, [
		blockers.length,
		result.waiting,
	]);
	const confirmFn = useCallback(async () => {
		if (!confirming || blockers.length > 0 || result.waiting) return;
		try {
			await removeFn({
				expectedRevision: project.revision,
				resourceId,
			});
			await navigateFn({
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
		navigateFn,
		project.projectId,
		project.revision,
		query,
		removeFn,
		resourceId,
		result.waiting,
	]);

	return {
		blockers,
		cancelFn,
		confirmFn,
		confirming,
		deleting: result.waiting,
		error: RendererRuntime.runSync(readSettledAsyncResultErrorFx(result)),
		openFn,
		project,
	};
};
