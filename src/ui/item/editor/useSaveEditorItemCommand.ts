import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useMemo, useState } from "react";

import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import type { saveEditorItemMutation } from "~/bridge/item/editor/saveEditorItemMutation";
import { saveEditorItemMutationFx } from "~/bridge/item/editor/saveEditorItemMutation";
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
			Atom.fn((variables: saveEditorItemMutation.Variables) =>
				saveEditorItemMutationFx(variables).pipe(Effect.map((result) => result.item)),
			).pipe(
				Atom.withLabel(`EditorItemSave:${projectId}:${itemUid}:${generation}`),
				Atom.setIdleTTL(0),
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
