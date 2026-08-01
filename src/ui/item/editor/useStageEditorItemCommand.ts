import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useMemo, useState } from "react";

import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import type { stageEditorItemMutation } from "~/bridge/item/editor/stageEditorItemMutation";
import { stageEditorItemMutationFx } from "~/bridge/item/editor/stageEditorItemMutation";
import { readSettledAsyncResultError } from "~/ui/reactivity/readSettledAsyncResultError";

/** Owns one mounted item-form staging command without duplicating pending or failure state. */
export const useStageEditorItemCommand = ({
	itemUid,
	projectId,
}: {
	readonly itemUid: string;
	readonly projectId: string;
}) => {
	const [generation, setGeneration] = useState(0);
	const reset = useCallback(() => {
		setGeneration((value) => value + 1);
	}, []);
	const mutationAtom = useMemo(
		() =>
			Atom.fn((variables: stageEditorItemMutation.Variables) =>
				stageEditorItemMutationFx(variables),
			).pipe(
				Atom.withLabel(`EditorItemStage:${projectId}:${itemUid}:${generation}`),
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
				item,
				projectId,
			}),
		reset,
	};
};
