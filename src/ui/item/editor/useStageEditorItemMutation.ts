import { useMutation } from "@tanstack/react-query";

import type { EditorItem, EditorItemFormValues } from "~/bridge/editor/EditorItemModel";
import { stageEditorItemMutationFx } from "~/bridge/editor/stageEditorItemMutation";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Adapts the standalone Effect mutation to the item form's narrow UI contract. */
export const useStageEditorItemMutation = ({
	onSuccess,
	projectId,
	sessionId,
	sourceItemId,
	sourcePath,
}: {
	readonly onSuccess: (item: EditorItem) => void;
	readonly projectId: string;
	readonly sessionId: string;
	readonly sourceItemId?: string;
	readonly sourcePath?: string;
}) => {
	const mutation = useMutation<EditorItem, Error, EditorItemFormValues>({
		mutationKey: [
			"editor",
			projectId,
			"item",
			sessionId,
		],
		mutationFn: (item) =>
			RendererRuntime.runPromise(
				stageEditorItemMutationFx({
					item,
					projectId,
					sourceItemId,
					sourcePath,
				}),
			),
		onSuccess,
	});
	return {
		error: mutation.error,
		isPending: mutation.isPending,
		mutate: mutation.mutate,
	};
};
