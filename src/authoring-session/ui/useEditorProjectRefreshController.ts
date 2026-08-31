import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { EditorUnsavedChanges } from "~/authoring-session/service/EditorUnsavedChanges";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { refreshEditorProjectFx } from "~/authoring-session/fx/refreshEditorProjectFx";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";

const readErrorMessageFn = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

const refreshEditorProjectCommandAtom = RendererRuntime.runSync(
	Effect.gen(function* () {
		const repository = yield* ProjectRepository;
		const writeAdmission = yield* ProjectWriteAdmission;
		const unsavedChanges = yield* EditorUnsavedChanges;
		return Atom.family((projectId: string) =>
			Atom.fn(
				() =>
					refreshEditorProjectFx({
						projectId,
					}).pipe(
						Effect.provideService(ProjectRepository, repository),
						Effect.provideService(ProjectWriteAdmission, writeAdmission),
						Effect.provideService(EditorUnsavedChanges, unsavedChanges),
					),
				{
					concurrent: false,
				},
			).pipe(Atom.setIdleTTL(0)),
		);
	}),
);

export namespace useEditorProjectRefreshController {
	export interface Props {
		readonly blocked: boolean;
		readonly projectId: string;
	}

	export interface Output {
		readonly disabled: boolean;
		readonly pending: boolean;
		readonly refresh: () => void;
		readonly tooltip: string;
	}
}

/** Owns hard-refresh command state; EditorShell only binds its presentation. */
export const useEditorProjectRefreshController = ({
	blocked,
	projectId,
}: useEditorProjectRefreshController.Props): useEditorProjectRefreshController.Output => {
	const router = useRouter();
	const commandAtom = refreshEditorProjectCommandAtom(projectId);
	const result = useAtomValue(commandAtom);
	const run = useAtomSet(commandAtom, {
		mode: "promise",
	});
	const pending = result.waiting;
	const disabled = blocked || pending;
	const error = RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	const refresh = () => {
		if (disabled) return;
		void run(undefined)
			.then((fresh) => {
				if (fresh.projectId === projectId) return;
				const currentRoot = `/editor/${encodeURIComponent(projectId)}`;
				const href = router.state.location.href;
				if (!href.startsWith(currentRoot))
					throw new Error("The refreshed Editor project is no longer routed.");
				return router.navigate({
					href: `/editor/${encodeURIComponent(fresh.projectId)}${href.slice(currentRoot.length)}`,
					ignoreBlocker: true,
					replace: true,
				});
			})
			.catch(() => undefined);
	};

	return {
		disabled,
		pending,
		refresh,
		tooltip:
			error === undefined
				? "Refresh from disk"
				: `Refresh failed: ${readErrorMessageFn(error)}`,
	};
};
