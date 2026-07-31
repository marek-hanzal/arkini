import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useCallback, useMemo, useState } from "react";

import type { EditorItem } from "~/bridge/editor/EditorItemModel";
import { createSaveEditorItemCommandAtom } from "~/bridge/editor/createSaveEditorItemCommandAtom";
import { readSettledAsyncResultError } from "~/ui/reactivity/readSettledAsyncResultError";

/** Owns one mounted item-form save command without duplicating pending or failure state. */
export const useSaveEditorItemCommand = ({
	expectedRevision,
	itemUid,
	projectId,
}: {
	readonly expectedRevision: string;
	readonly itemUid: string;
	readonly projectId: string;
}) => {
	const [generation, setGeneration] = useState(0);
	const reset = useCallback(() => {
		setGeneration((value) => value + 1);
	}, []);
	const mutationAtom = useMemo(
		() =>
			createSaveEditorItemCommandAtom(
				`EditorItemSave:${projectId}:${itemUid}:${generation}`,
			),
		[
			generation,
			itemUid,
			projectId,
		],
	);
	const result = useAtomValue(mutationAtom);
	const run = useAtomSet(mutationAtom, {
		mode: "promise",
	});
	return {
		error: readSettledAsyncResultError(result),
		mutateAsync: (item: EditorItem) =>
			run({
				expectedRevision,
				item,
				projectId,
			}),
		reset,
	};
};
