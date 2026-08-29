import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";

import { useEditorProject } from "~/ui/editor/useEditorProject";
import { deleteEditorItemCommandAtom } from "~/ui/item/editor/deleteEditorItemCommandAtom";
import { RendererRuntime } from "~/renderer/RendererRuntime";
import {
	forceDeleteEditorItemFx,
	type EditorItemForceDeleteImpact,
} from "~/editor/forceDeleteEditorItemFx";
import {
	readEditorItemDeleteBlockersFx,
	type EditorItemDeleteBlocker,
} from "~/editor/readEditorItemDeleteBlockersFx";
import { useEditorHistoryBack } from "~/ui/editor/useEditorHistoryBack";
import { readSettledAsyncResultErrorFx } from "~/ui/reactivity/readSettledAsyncResultErrorFx";

export namespace useEditorItemDeleteController {
	export interface Props {
		readonly item: ItemSchema.Type;
	}

	export interface Output {
		readonly blockers: ReadonlyArray<EditorItemDeleteBlocker>;
		readonly cancel: () => void;
		readonly confirm: () => Promise<void>;
		readonly confirming: "safe" | "force" | null;
		readonly deleting: boolean;
		readonly error: unknown;
		readonly forceImpact: EditorItemForceDeleteImpact;
		readonly open: (force: boolean) => void;
		readonly project: ReturnType<typeof useEditorProject>;
	}
}

/** Owns item-delete eligibility, confirmation, persistence, and terminal navigation. */
export const useEditorItemDeleteController = ({
	item,
}: useEditorItemDeleteController.Props): useEditorItemDeleteController.Output => {
	const project = useEditorProject();
	const navigate = useNavigate();
	const historyBack = useEditorHistoryBack();
	const commandAtom = deleteEditorItemCommandAtom(project.projectId);
	const result = useAtomValue(commandAtom);
	const remove = useAtomSet(commandAtom, {
		mode: "promise",
	});
	const [confirming, setConfirming] = useState<"safe" | "force" | null>(null);
	const blockers = useMemo(
		() =>
			RendererRuntime.runSync(
				readEditorItemDeleteBlockersFx({
					config: project.config,
					itemId: item.id,
				}),
			),
		[
			item.id,
			project.config,
		],
	);
	const forceImpact = useMemo(
		() =>
			RendererRuntime.runSync(
				forceDeleteEditorItemFx({
					config: project.config,
					itemId: item.id,
				}),
			).impact,
		[
			item.id,
			project.config,
		],
	);
	const cancel = useCallback(() => {
		if (!result.waiting) setConfirming(null);
	}, [
		result.waiting,
	]);
	const open = useCallback(
		(force: boolean) => {
			if ((force || blockers.length === 0) && !result.waiting)
				setConfirming(force ? "force" : "safe");
		},
		[
			blockers.length,
			result.waiting,
		],
	);
	const confirm = useCallback(async () => {
		if (confirming === null || (confirming === "safe" && blockers.length > 0) || result.waiting)
			return;
		try {
			await remove({
				expectedRevision: project.revision,
				force: confirming === "force",
				itemUid: item.uid,
			});
			if (historyBack(() => undefined)) return;
			await navigate({
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
		historyBack,
		item.uid,
		navigate,
		project.projectId,
		project.revision,
		remove,
		result.waiting,
	]);

	return {
		blockers,
		cancel,
		confirm,
		confirming,
		deleting: result.waiting,
		error: RendererRuntime.runSync(readSettledAsyncResultErrorFx(result)),
		forceImpact,
		open,
		project,
	};
};
