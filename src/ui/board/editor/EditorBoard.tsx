import { useAtomValue } from "@effect/atom-react";
import { useState, useSyncExternalStore } from "react";

import type { EditorBoardGame } from "~/bridge/editor/board/EditorBoardGame";
import { EditorBoardGameAtom } from "~/bridge/editor/board/EditorBoardGameAtom";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { GameEngineProvider } from "~/bridge/game/GameEngineProvider";
import { PlayableBoard } from "~/ui/game/PlayableBoard";
import { PlayableGameRoute } from "~/ui/game/PlayableGameRoute";
import { PlayableInventory } from "~/ui/game/PlayableInventory";
import { PlayableGameShell } from "~/ui/shell/GameShell";

type EditorGameResource = GameEngineResource<EditorBoardGame>;
type EditorGameLeaf = "board" | "inventory";

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
	const [leaf, setLeaf] = useState<EditorGameLeaf>("board");
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
				<PlayableGameShell routePresentation="embedded">
					{leaf === "board" ? (
						<PlayableBoard onOpenInventory={() => setLeaf("inventory")} />
					) : (
						<PlayableInventory onClose={() => setLeaf("board")} />
					)}
				</PlayableGameShell>
			</PlayableGameRoute>
		</GameEngineProvider>
	);
};

/** Presents the latest revision-pinned editor game through the shared gameplay UI. */
export const EditorBoard = () => {
	const project = useEditorProject();
	const state = useAtomValue(EditorBoardGameAtom);
	if (
		state.type === "ready" &&
		state.resource.game.projectId === project.projectId &&
		state.resource.game.projectRevision === project.revision
	) {
		return (
			<EditorBoardReady
				key={project.revision}
				resource={state.resource}
			/>
		);
	}
	if (
		state.type === "failed" &&
		state.projectId === project.projectId &&
		state.projectRevision === project.revision
	) {
		return (
			<EditorBoardStatus
				detail={String(state.error)}
				title="Editor game could not synchronize"
			/>
		);
	}
	return (
		<EditorBoardStatus
			detail="Starting a fresh ephemeral game from the latest project revision."
			title="Preparing editor game…"
		/>
	);
};
