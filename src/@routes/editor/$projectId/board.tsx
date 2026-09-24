import { match } from "ts-pattern";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";
import { useAtomValue } from "@effect/atom-react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useSyncExternalStore, type ReactNode } from "react";

import type { EditorBoardGame } from "~/editor-board/type/EditorBoardGame";
import { EditorBoardGameAtom } from "~/editor-board/atom/EditorBoardGameAtom";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { GameEngineResource } from "~/playable-game/type/GameEngineResource";
import { GameEngineProvider } from "~/game-presentation/ui/GameEngineProvider";
import { PlayableGameResources } from "~/game-shell/ui/PlayableGameResources";
import { EditorBoardToolbar } from "~/editor-board/ui/EditorBoardToolbar";
import { PlayableGameShell } from "~/game-shell/ui/GameShell";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";

type EditorGameResource = GameEngineResource<EditorBoardGame>;

const EditorBoardStatus = ({
	detail,
	title,
}: {
	readonly detail: ReactNode;
	readonly title: ReactNode;
}) => (
	<section
		className="grid size-full place-items-center overflow-y-auto p-3"
		data-ui="EditorBoardStatus"
	>
		<div className="w-full max-w-xl rounded-2xl border border-line bg-surface-raised p-6 text-center shadow-xl">
			<h1 className="text-xl font-semibold">{title}</h1>
			<div className="mt-3 break-words text-sm leading-6 text-muted">{detail}</div>
		</div>
	</section>
);

const EditorBoardReady = ({ resource }: { readonly resource: EditorGameResource }) => {
	const failure = useSyncExternalStore(
		resource.subscribeCriticalFailureFn,
		resource.getCriticalFailureFn,
		resource.getCriticalFailureFn,
	);
	if (failure !== null) {
		return (
			<EditorBoardStatus
				detail={failure.message}
				title={<Tx label="Editor game stopped" />}
			/>
		);
	}
	return (
		<GameEngineProvider game={resource.game}>
			<PlayableGameResources>
				<PlayableGameShell routePresentation="embedded-transition">
					<Outlet />
				</PlayableGameShell>
			</PlayableGameResources>
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
			<EditorSectionPage
				contentMode="viewport"
				header={
					<EditorBoardToolbar
						game={ready ? state.resource.game : undefined}
						project={project}
					/>
				}
			>
				<section
					className="size-full min-h-0"
					data-ui="EditorBoard"
				>
					{match(state)
						.with(
							{
								type: "ready",
								resource: {
									game: {
										projectId: project.projectId,
										projectRevision: project.revision,
									},
								},
							},
							(state) => <EditorBoardReady resource={state.resource} />,
						)
						.with(
							{
								type: "failed",
								projectId: project.projectId,
								projectRevision: project.revision,
							},
							(state) => (
								<EditorBoardStatus
									detail={String(state.error)}
									title={<Tx label="Editor game could not synchronize" />}
								/>
							),
						)
						.otherwise(() => (
							<EditorBoardStatus
								detail={<Mx label="Editor Board preparing description" />}
								title={<Tx label="Preparing editor game…" />}
							/>
						))}
				</section>
			</EditorSectionPage>
		);
	},
});
