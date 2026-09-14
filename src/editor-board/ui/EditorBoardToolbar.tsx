import { useAtomValue } from "@effect/atom-react";
import { RotateCcw } from "lucide-react";

import { EditorBoardGameResourceOwnerAtom } from "~/editor-board/atom/EditorBoardGameResourceOwnerAtom";
import type { Project } from "~/project-authoring/type/Project";
import { LinkButton } from "~/ui/ui/LinkButton";
import type { EditorBoardGame } from "~/editor-board/type/EditorBoardGame";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { useCheatsModel } from "~/game-cheat/ui/useCheatsModel";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";
import { SegmentedControl } from "~/ui/ui/SegmentedControl";
import { useTranslator } from "~/translation/ui/useTranslator";

const BoardGameplayControls = ({
	game,
	project,
}: {
	readonly game: EditorBoardGame;
	readonly project: Project;
}) => {
	const owner = useAtomValue(EditorBoardGameResourceOwnerAtom);
	const cheats = useCheatsModel(game);
	const translator = useTranslator();
	return (
		<>
			<LinkButton
				className="mr-2 inline-flex items-center gap-2"
				data-ui="EditorBoardReset"
				disabled={cheats.blocked || owner === undefined}
				onClick={() => {
					if (owner !== undefined) cheats.requestExitFn(owner.resetFx(project, game));
				}}
			>
				<RotateCcw className="size-4" />
				<Tx label="Reset" />
			</LinkButton>
			<SegmentedControl
				dataUi="EditorBoardGameplayMode"
				onChangeFn={(mode) => cheats.setSpeedUpGameplayFn(mode === "speed-up")}
				optionDataUi="EditorBoardGameplayModeOption"
				options={[
					{
						label: translator.textFn("Default"),
						value: "default",
					},
					{
						label: translator.textFn("Speed up"),
						value: "speed-up",
					},
				]}
				pending={cheats.blocked}
				size="compact"
				value={cheats.speedUpGameplay ? "speed-up" : "default"}
			/>
		</>
	);
};

/** Owns navigation and gameplay controls for the ephemeral Editor Board. */
export const EditorBoardToolbar = ({
	game,
	project,
}: {
	readonly game?: EditorBoardGame;
	readonly project: Project;
}) => (
	<header
		className="flex shrink-0 items-center gap-2"
		data-ui="EditorBoardToolbar"
	>
		<EditorHistoryBackButton
			params={{
				projectId: project.projectId,
			}}
			to="/editor/$projectId/editor/items/list"
		/>
		<h1 className="min-w-0 flex-1 truncate text-xl font-semibold">
			<Tx label="Board" />
		</h1>
		{game === undefined ? null : (
			<BoardGameplayControls
				game={game}
				project={project}
			/>
		)}
		<EditorPageHelp
			content={<Mx label="Editor Board help" />}
			title={<Tx label="Editor Board" />}
		/>
	</header>
);
