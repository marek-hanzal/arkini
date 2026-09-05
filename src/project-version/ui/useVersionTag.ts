import { Effect } from "effect";
import { useCallback, useEffect, useState } from "react";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { ProjectVersionDescriptor } from "~/project-version/type/ProjectVersion";

interface VersionTagProps {
	readonly reloadFn: () => void;
	readonly projectId: string;
	readonly reportErrorFn: (error?: unknown) => void;
	readonly selected?: ProjectVersionDescriptor;
}

interface VersionTagOutput {
	readonly draft: string;
	readonly pending: boolean;
	readonly saveFn: () => void;
	readonly setDraftFn: (value: string) => void;
}

/** Owns the editable user-only label for one selected immutable version. */
export const useVersionTag = ({
	reloadFn,
	projectId,
	reportErrorFn,
	selected,
}: VersionTagProps): VersionTagOutput => {
	const [draft, setDraftFn] = useState("");
	const [pending, setPendingFn] = useState(false);

	useEffect(
		() => setDraftFn(selected?.tag ?? ""),
		[
			projectId,
			selected?.versionId,
			selected?.tag,
		],
	);
	const saveFn = useCallback(() => {
		if (selected === undefined || pending) return;
		setPendingFn(true);
		reportErrorFn();
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
				setPendingFn(false);
				reloadFn();
			})
			.catch((cause) => {
				reportErrorFn(cause);
				setPendingFn(false);
			});
	}, [
		draft,
		pending,
		projectId,
		reloadFn,
		reportErrorFn,
		selected,
	]);

	return {
		draft,
		pending,
		saveFn,
		setDraftFn,
	};
};
