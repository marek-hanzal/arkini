import { useMutation } from "@tanstack/react-query";

import type { EditorItem, EditorItemFormValues } from "~/bridge/editor/EditorItemModel";
import { saveEditorItemMutationFx } from "~/bridge/editor/saveEditorItemMutation";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Runs one direct canonical item save from the local form state. */
export const useSaveEditorItemMutation = ({
	expectedRevision,
	projectId,
}: {
	readonly expectedRevision: string;
	readonly projectId: string;
}) => {
	const mutation = useMutation<EditorItem, Error, EditorItemFormValues>({
		mutationKey: [
			"editor",
			projectId,
			"item",
		],
		mutationFn: async (item) => {
			const result = await RendererRuntime.runPromise(
				saveEditorItemMutationFx({
					expectedRevision,
					item,
					projectId,
				}),
			);
			return result.item;
		},
	});
	return {
		error: mutation.error,
		isPending: mutation.isPending,
		mutateAsync: mutation.mutateAsync,
		reset: mutation.reset,
	};
};
