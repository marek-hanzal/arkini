import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useState } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { renameProjectIdentityFx } from "~/project-authoring/fx/renameProjectIdentityFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { useEditorUnsavedChangesOwner } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import type { Project } from "~/project-authoring/type/Project";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";

const renameProjectIdentityCommandAtom = RendererRuntime.runSync(
	Effect.gen(function* () {
		const repository = yield* ProjectRepository;
		const admission = yield* ProjectWriteAdmission;
		return Atom.family((projectId: string) =>
			Atom.fn(
				({
					isNavigationPendingFn,
					onRenamedFn,
					...props
				}: Omit<renameProjectIdentityFx.Props, "projectId"> & {
					readonly isNavigationPendingFn: () => boolean;
					readonly onRenamedFn: (projectId: string) => Promise<void>;
				}) =>
					Effect.acquireUseRelease(
						admission.acquireIdentityRenameFx(isNavigationPendingFn),
						() =>
							renameProjectIdentityFx({
								...props,
								projectId,
							}).pipe(
								Effect.provideService(ProjectRepository, repository),
								Effect.tap((commit) =>
									Effect.tryPromise({
										try: () => onRenamedFn(commit.projectId),
										catch: (cause) => cause,
									}),
								),
								// A committed namespace must reach its route before another replacement can start.
								Effect.uninterruptible,
							),
						(releaseFx) => releaseFx,
					),
			).pipe(Atom.setIdleTTL(0)),
		);
	}),
);

export namespace useProjectIdentityRenameController {
	export interface Props {
		readonly project: Project;
	}

	export interface Output {
		readonly cancelFn: () => void;
		readonly confirming: boolean;
		readonly error: unknown;
		readonly openFn: () => void;
		readonly pending: boolean;
		readonly renameFn: (newProjectId: string) => Promise<void>;
	}
}

/** Owns project-identity confirmation, persistence, and terminal route replacement. */
export const useProjectIdentityRenameController = ({
	project,
}: useProjectIdentityRenameController.Props): useProjectIdentityRenameController.Output => {
	const navigateFn = useNavigate();
	const router = useRouter();
	const unsavedOwner = useEditorUnsavedChangesOwner();
	const commandAtom = renameProjectIdentityCommandAtom(project.projectId);
	const result = useAtomValue(commandAtom);
	const runRenameFn = useAtomSet(commandAtom, {
		mode: "promise",
	});
	const [confirming, setConfirmingFn] = useState(false);
	const cancelFn = useCallback(() => {
		if (!result.waiting) setConfirmingFn(false);
	}, [
		result.waiting,
	]);
	const openFn = useCallback(() => {
		if (!result.waiting) setConfirmingFn(true);
	}, [
		result.waiting,
	]);
	const renameFn = useCallback(
		async (newProjectId: string) => {
			if (!confirming || result.waiting) return;
			if (
				!(await unsavedOwner.requestLeaveFn(
					`/editor/${encodeURIComponent(newProjectId)}/project/detail/general`,
				))
			)
				return;
			try {
				await runRenameFn({
					config: project.config,
					expectedRevision: project.revision,
					newProjectId,
					isNavigationPendingFn: () => router.state.status === "pending",
					onRenamedFn: (projectId) =>
						navigateFn({
							to: "/editor/$projectId/project/detail/$sectionId",
							params: {
								projectId,
								sectionId: "general",
							},
							ignoreBlocker: true,
							replace: true,
						}),
				});
			} catch {
				// The settled command error remains visible in the confirmation dialog.
			}
		},
		[
			confirming,
			navigateFn,
			project.config,
			project.revision,
			result.waiting,
			runRenameFn,
			router,
			unsavedOwner,
		],
	);
	return {
		cancelFn,
		confirming,
		error: RendererRuntime.runSync(readSettledAsyncResultErrorFx(result)),
		openFn,
		pending: result.waiting,
		renameFn,
	};
};
