import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useMemo, useState } from "react";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { forceDeleteFx } from "~/item-authoring/fx/forceDeleteFx";
import { readDeleteBlockersFn } from "~/item-authoring/fn/readDeleteBlockersFn";
import { deleteFx } from "~/item-authoring/fx/deleteFx";
import { useEditorHistoryBack } from "~/authoring-shell/ui/useEditorHistoryBack";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import type { Project } from "~/project-authoring/type/Project";

const deleteCommandAtom = RendererRuntime.runSync(
	Effect.map(ProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((props: Omit<deleteFx.Props, "projectId">) =>
				deleteFx({
					...props,
					projectId,
				}).pipe(Effect.provideService(ProjectRepository, repository)),
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
	const historyBackFn = useEditorHistoryBack();
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
				itemId: item.id,
			}),
		[
			item.id,
			project.config,
		],
	);
	const forceImpact = useMemo(
		() =>
			RendererRuntime.runSync(
				forceDeleteFx({
					config: project.config,
					itemId: item.id,
				}),
			).impact,
		[
			item.id,
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
		try {
			await removeFn({
				expectedRevision: project.revision,
				force: confirming === "force",
				itemUid: item.uid,
			});
			if (historyBackFn(() => undefined)) return;
			await navigateFn({
				to: "/editor/$projectId/editor/items/list",
				params: {
					projectId: project.projectId,
				},
				replace: true,
			});
		} catch {
			// The settled command error remains visible in the confirmation dialog.
		}
	}, [
		blockers.length,
		confirming,
		historyBackFn,
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
