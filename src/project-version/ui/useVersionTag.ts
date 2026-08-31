import { Effect } from "effect";
import { useCallback, useEffect, useState } from "react";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { ProjectVersionDescriptor } from "~/project-version/type/ProjectVersion";

interface VersionTagProps {
	readonly reload: () => void;
	readonly projectId: string;
	readonly reportError: (error?: unknown) => void;
	readonly selected?: ProjectVersionDescriptor;
}

interface VersionTagOutput {
	readonly draft: string;
	readonly pending: boolean;
	readonly save: () => void;
	readonly setDraft: (value: string) => void;
}

/** Owns the editable user-only label for one selected immutable version. */
export const useVersionTag = ({
	reload,
	projectId,
	reportError,
	selected,
}: VersionTagProps): VersionTagOutput => {
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
			Effect.flatMap(ProjectRepository, (repository) =>
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
