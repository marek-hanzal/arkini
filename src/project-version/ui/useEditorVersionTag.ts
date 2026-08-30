import { Effect } from "effect";
import { useCallback, useEffect, useState } from "react";

import { EditorProjectRepository } from "~/project-authoring/service/EditorProjectRepository";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { EditorProjectVersionDescriptor } from "~/project-version/type/EditorProjectVersion";

export namespace useEditorVersionTag {
	export interface Props {
		readonly reload: () => void;
		readonly projectId: string;
		readonly reportError: (error?: unknown) => void;
		readonly selected?: EditorProjectVersionDescriptor;
	}

	export interface Output {
		readonly draft: string;
		readonly pending: boolean;
		readonly save: () => void;
		readonly setDraft: (value: string) => void;
	}
}

/** Owns the editable user-only label for one selected immutable version. */
export const useEditorVersionTag = ({
	reload,
	projectId,
	reportError,
	selected,
}: useEditorVersionTag.Props): useEditorVersionTag.Output => {
	const [draft, setDraft] = useState("");
	const [pending, setPending] = useState(false);

	useEffect(
		() => setDraft(selected?.tag ?? ""),
		[
			selected,
		],
	);
	const save = useCallback(() => {
		if (selected === undefined || pending) return;
		setPending(true);
		reportError();
		void RendererRuntime.runPromise(
			Effect.flatMap(EditorProjectRepository, (repository) =>
				repository.updateVersionTagFx({
					projectId,
					...(draft.trim() === ""
						? {}
						: {
								tag: draft,
							}),
					versionId: selected.versionId,
				}),
			),
		)
			.then(() => {
				setPending(false);
				reload();
			})
			.catch((cause) => {
				reportError(cause);
				setPending(false);
			});
	}, [
		draft,
		pending,
		projectId,
		reload,
		reportError,
		selected,
	]);

	return {
		draft,
		pending,
		save,
		setDraft,
	};
};
