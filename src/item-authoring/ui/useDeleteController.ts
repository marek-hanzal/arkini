import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { forceDeleteFx } from "~/item-authoring/fx/forceDeleteFx";
import { readDeleteBlockersFn } from "~/item-authoring/fn/readDeleteBlockersFn";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import type { Project } from "~/project-authoring/type/Project";

interface DeleteCommandProps {
	readonly expectedRevision: number;
	readonly force: boolean;
	readonly itemUid: string;
	readonly onDeletedFn: () => Promise<void>;
}

const deleteCommandAtom = RendererRuntime.runSync(
	Effect.map(
		Effect.all([
			ProjectRepository,
			ProjectWriteAdmission,
		]),
		([repository, admission]) =>
			Atom.family((projectId: string) =>
				Atom.fn(({ onDeletedFn, ...props }: DeleteCommandProps) =>
					Effect.gen(function* () {
						yield* Effect.yieldNow;
						return yield* admission.admitWriteFx(
							"delete-item",
							Effect.uninterruptible(
								Effect.gen(function* () {
									const commit = yield* repository.deleteItemFx({
										...props,
										projectId,
									});
									// Leave the item route before its mounted readers can observe the deletion.
									// Publication must survive both route unmount and navigation failure.
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
												commit,
											}),
										),
									);
									return commit;
								}),
							),
						);
					}),
				).pipe(Atom.setIdleTTL(0)),
			),
	),
);

export namespace useDeleteController {
	export interface Props {
		readonly item: ItemSchema.Type;
	}

	export interface Output {
		readonly blockers: ReadonlyArray<readDeleteBlockersFn.Blocker>;
		readonly cancelFn: () => void;
		readonly confirmFn: () => Promise<void>;
		readonly confirming: "safe" | "force" | null;
		readonly deleting: boolean;
		readonly error: unknown;
		readonly forceImpact: forceDeleteFx.Impact;
		readonly openFn: (force: boolean) => void;
		readonly project: Project;
	}
}

/** Owns item-delete eligibility, confirmation, persistence, and terminal navigation. */
export const useDeleteController = ({
	item,
}: useDeleteController.Props): useDeleteController.Output => {
	const project = useEditorProject();
	const navigateFn = useNavigate();
	const sessionGeneration = useRef(0);
	useLayoutEffect(
		() => () => {
			sessionGeneration.current += 1;
		},
		[
			project.projectId,
			item.uid,
		],
	);
	const commandAtom = deleteCommandAtom(project.projectId);
	const result = useAtomValue(commandAtom);
	const removeFn = useAtomSet(commandAtom, {
		mode: "promise",
	});
	const [confirming, setConfirmingFn] = useState<"safe" | "force" | null>(null);
	const blockers = useMemo(
		() =>
			readDeleteBlockersFn({
				config: project.config,
				itemUid: item.uid,
			}),
		[
			item.uid,
			project.config,
		],
	);
	const forceImpact = useMemo(
		() =>
			RendererRuntime.runSync(
				forceDeleteFx({
					config: project.config,
					itemUid: item.uid,
				}),
			).impact,
		[
			item.uid,
			project.config,
		],
	);
	const cancelFn = useCallback(() => {
		if (!result.waiting) setConfirmingFn(null);
	}, [
		result.waiting,
	]);
	const openFn = useCallback(
		(force: boolean) => {
			if ((force || blockers.length === 0) && !result.waiting)
				setConfirmingFn(force ? "force" : "safe");
		},
		[
			blockers.length,
			result.waiting,
		],
	);
	const confirmFn = useCallback(async () => {
		if (confirming === null || (confirming === "safe" && blockers.length > 0) || result.waiting)
			return;
		const submittedSession = sessionGeneration.current;
		try {
			await removeFn({
				expectedRevision: project.revision,
				force: confirming === "force",
				itemUid: item.uid,
				onDeletedFn: async () => {
					// The admitted deletion still publishes after its original route has left.
					if (sessionGeneration.current !== submittedSession) return;
					await navigateFn({
						to: "/editor/$projectId/editor/items/list",
						params: {
							projectId: project.projectId,
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
		item.uid,
		navigateFn,
		project.projectId,
		project.revision,
		removeFn,
		result.waiting,
	]);

	return {
		blockers,
		cancelFn,
		confirmFn,
		confirming,
		deleting: result.waiting,
		error: RendererRuntime.runSync(readSettledAsyncResultErrorFx(result)),
		forceImpact,
		openFn,
		project,
	};
};
