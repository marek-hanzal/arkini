import { useAtomValue } from "@effect/atom-react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";

import { EditorBoardGameAtom } from "~/bridge/editor/board/EditorBoardGameAtom";
import type { EditorBoardGameResource } from "~/bridge/editor/board/EditorBoardGameResource";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { GameEngineProvider } from "~/bridge/game/GameEngineProvider";
import { PlayableGameRoute } from "~/ui/game/PlayableGameRoute";
import { EditorBoardItemDetailLink } from "~/ui/board/editor/EditorBoardItemDetailLink";
import { EditorBoardProductionLineLink } from "~/ui/board/editor/EditorBoardProductionLineLink";
import { EditorBoardScenarioToolbar } from "~/ui/board/editor/EditorBoardScenarioToolbar";
import { PlayableGameShell } from "~/ui/shell/GameShell";

type EditorGameResource = EditorBoardGameResource.Resource;

const EditorBoardStatus = ({
	detail,
	title,
}: {
	readonly detail: string;
	readonly title: string;
}) => (
	<section
		className="grid size-full place-items-center overflow-y-auto p-3"
		data-ui="EditorBoardStatus"
	>
		<div className="w-full max-w-xl rounded-2xl border border-line bg-surface-raised p-6 text-center shadow-xl">
			<h1 className="text-xl font-semibold">{title}</h1>
			<p className="mt-3 break-words text-sm leading-6 text-muted">{detail}</p>
		</div>
	</section>
);

const EditorBoardReady = ({ resource }: { readonly resource: EditorGameResource }) => {
	const failure = useSyncExternalStore(
		resource.subscribeCriticalFailure,
		resource.getCriticalFailure,
		resource.getCriticalFailure,
	);
	if (failure !== null) {
		return (
			<EditorBoardStatus
				detail={failure.message}
				title="Editor game stopped"
			/>
		);
	}
	return (
		<GameEngineProvider game={resource.game}>
			<PlayableGameRoute>
				<PlayableGameShell
					itemDetailIdentityRenderer={EditorBoardItemDetailLink}
					itemDetailLineIdentityRenderer={EditorBoardProductionLineLink}
					routePresentation="embedded-transition"
				>
					<Outlet />
				</PlayableGameShell>
			</PlayableGameRoute>
		</GameEngineProvider>
	);
};

export const Route = createFileRoute("/editor/$projectId/board")({
	component: () => {
		const project = useEditorProject();
		const state = useAtomValue(EditorBoardGameAtom);
		const ready =
			state.type === "ready" &&
			state.resource.game.resourceMetadata.projectId === project.projectId &&
			state.resource.game.resourceMetadata.projectRevision === project.revision;
		return (
			<section className="grid size-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
				<EditorBoardScenarioToolbar
					game={ready ? state.resource.game : undefined}
					project={project}
				/>
				{ready ? (
					<EditorBoardReady resource={state.resource} />
				) : state.type === "failed" &&
					state.projectId === project.projectId &&
					state.projectRevision === project.revision ? (
					<EditorBoardStatus
						detail={String(state.error)}
						title="Editor game could not synchronize"
					/>
				) : (
					<EditorBoardStatus
						detail="Starting a fresh game from the latest project revision."
						title="Preparing editor game…"
					/>
				)}
			</section>
		);
	},
});
