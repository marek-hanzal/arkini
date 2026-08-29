import { useAtomValue } from "@effect/atom-react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";

import type { EditorBoardGame } from "~/board-scenario/session/EditorBoardGame";
import { EditorBoardGameAtom } from "~/board-scenario/toolbar/EditorBoardGameAtom";
import { useEditorProject } from "~/authoring-session/useEditorProject";
import type { GameEngineResource } from "~/renderer/game/resource/GameEngineResource";
import { GameEngineProvider } from "~/ui/game/GameEngineProvider";
import { PlayableGameRoute } from "~/ui/game/PlayableGameRoute";
import { EditorBoardItemDetailLink } from "~/board-scenario/toolbar/EditorBoardItemDetailLink";
import { EditorBoardProductionLineLink } from "~/board-scenario/toolbar/EditorBoardProductionLineLink";
import { EditorBoardScenarioToolbar } from "~/board-scenario/toolbar/EditorBoardScenarioToolbar";
import { PlayableGameShell } from "~/ui/shell/GameShell";

type EditorGameResource = GameEngineResource<EditorBoardGame>;

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
			state.resource.game.projectId === project.projectId &&
			state.resource.game.projectRevision === project.revision;
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
