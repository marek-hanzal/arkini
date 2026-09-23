import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import type { ArtworkCatalogFilterSchema } from "~/artwork-authoring/schema/ArtworkCatalogFilterSchema";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { readEditorArtworkDeleteBlockersFn } from "~/artwork-authoring/fn/readEditorArtworkDeleteBlockersFn";
import type { readGameResourceUsagesFn } from "~/game-config-resource/fn/readGameResourceUsagesFn";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import type { Project } from "~/project-authoring/type/Project";

interface DeleteEditorArtworkCommandProps {
	readonly expectedRevision: number;
	readonly resourceUid: string;
	readonly onDeletedFn: () => Promise<void>;
}

const deleteEditorArtworkCommandAtom = RendererRuntime.runSync(
	Effect.map(
		Effect.all([
			ProjectRepository,
			ProjectWriteAdmission,
		]),
		([repository, admission]) =>
			Atom.family((projectId: string) =>
				Atom.fn(({ onDeletedFn, ...props }: DeleteEditorArtworkCommandProps) =>
					Effect.gen(function* () {
						yield* Effect.yieldNow;
						return yield* admission.admitWriteFx(
							"delete-resource",
							Effect.uninterruptible(
								Effect.gen(function* () {
									const project = yield* repository.deleteResourceFx({
										...props,
										projectId,
									});
									// Leave before publication removes the detail's mounted readers.
									// Canonical publication survives route departure and navigation failure.
									yield* Effect.tryPromise({
										// Refresh owns the route while it waits for this command to publish.
										try: () =>
											admission.isNavigationBlockedFn()
												? Promise.resolve()
												: onDeletedFn(),
										catch: (cause) => cause,
									}).pipe(
										Effect.ensuring(
											publishEditorProjectFx(projectId, {
												project,
											}),
										),
									);
									return project;
								}),
							),
						);
					}),
				).pipe(Atom.setIdleTTL(0)),
			),
	),
);

export namespace useEditorArtworkDeleteController {
	export interface Props {
		readonly filter: ArtworkCatalogFilterSchema.Type;
		readonly query: string;
		readonly resourceUid: string;
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

/** Owns artwork-delete eligibility, confirmation, persistence, and terminal navigation. */
export const useEditorArtworkDeleteController = ({
	filter,
	query,
	resourceUid,
}: useEditorArtworkDeleteController.Props): useEditorArtworkDeleteController.Output => {
	const project = useEditorProject();
	const navigateFn = useNavigate();
	const sessionGeneration = useRef(0);
	useLayoutEffect(
		() => () => {
			sessionGeneration.current += 1;
		},
		[
			project.projectId,
			resourceUid,
		],
	);
	const commandAtom = deleteEditorArtworkCommandAtom(project.projectId);
	const result = useAtomValue(commandAtom);
	const removeFn = useAtomSet(commandAtom, {
		mode: "promise",
	});
	const [confirming, setConfirmingFn] = useState(false);
	const blockers = useMemo(
		() =>
			readEditorArtworkDeleteBlockersFn({
				config: project.config,
				resourceUid,
			}),
		[
			project.config,
			resourceUid,
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
		const submittedSession = sessionGeneration.current;
		try {
			await removeFn({
				expectedRevision: project.revision,
				resourceUid,
				onDeletedFn: async () => {
					// Deletion still publishes after departure; only its original UI may navigate.
					if (sessionGeneration.current !== submittedSession) return;
					await navigateFn({
						to: "/editor/$projectId/artwork",
						params: {
							projectId: project.projectId,
						},
						search: {
							filter,
							query,
						},
						replace: true,
					});
				},
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
		resourceUid,
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
