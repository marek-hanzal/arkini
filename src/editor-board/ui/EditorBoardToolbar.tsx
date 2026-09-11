import type { EditorBoardGame } from "~/editor-board/type/EditorBoardGame";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { useCheatsModel } from "~/game-cheat/ui/useCheatsModel";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";
import { SegmentedControl } from "~/ui/ui/SegmentedControl";

const BoardGameplayModeControl = ({ game }: { readonly game: EditorBoardGame }) => {
	const cheats = useCheatsModel(game);
	return (
		<SegmentedControl
			dataUi="EditorBoardGameplayMode"
			onChangeFn={(mode) => cheats.setInstantGameplayFn(mode === "instant")}
			optionDataUi="EditorBoardGameplayModeOption"
			options={[
				{
					label: "Default",
					value: "default",
				},
				{
					label: "Instant",
					value: "instant",
				},
			]}
			pending={cheats.blocked}
			size="compact"
			value={cheats.instantGameplay ? "instant" : "default"}
		/>
	);
};

/** Owns navigation and gameplay controls for the ephemeral Editor Board. */
export const EditorBoardToolbar = ({
	game,
	projectId,
}: {
	readonly game?: EditorBoardGame;
	readonly projectId: string;
}) => (
	<header
		className="flex shrink-0 items-center gap-2"
		data-ui="EditorBoardToolbar"
	>
		<EditorHistoryBackButton
			params={{
				projectId,
			}}
			to="/editor/$projectId/editor/items/list"
		/>
		<div className="flex-1" />
		{game === undefined ? null : <BoardGameplayModeControl game={game} />}
		<EditorPageHelp
			content={<Mx label="Editor Board help" />}
			title={<Tx label="Editor Board" />}
		/>
	</header>
);
