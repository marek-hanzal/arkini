import { Plus, Save, Trash2 } from "lucide-react";

import type { Project } from "~/project-authoring/type/Project";
import type { EditorBoardGame } from "~/board-scenario/type/EditorBoardGame";
import { useBoardScenarioToolbar } from "~/board-scenario/ui/useBoardScenarioToolbar";
import { Button } from "~/ui/ui/Button";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { EditorSearchCombobox } from "~/editor-control/ui/EditorSearchCombobox";
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
					label: "Instant",
					value: "instant",
				},
				{
					label: "Common",
					value: "common",
				},
			]}
			pending={cheats.blocked}
			size="compact"
			value={cheats.instantGameplay ? "instant" : "common"}
		/>
	);
};

/** Presents the explicit named scenario selector without owning persistence rules. */
export const BoardScenarioToolbar = ({
	game,
	project,
}: {
	readonly game?: EditorBoardGame;
	readonly project: Project;
}) => {
	const controller = useBoardScenarioToolbar({
		game,
		project,
	});
	return (
		<header
			className="grid shrink-0 grid-cols-[auto_minmax(16rem,32rem)_auto_minmax(0,1fr)_auto_auto] items-center gap-2"
			data-ui="EditorBoardScenarioToolbar"
		>
			<EditorHistoryBackButton
				params={{
					projectId: project.projectId,
				}}
				to="/editor/$projectId/editor/items/list"
			/>
			<EditorSearchCombobox
				displaySelectedLabel
				emptyLabel="No scenarios match this search."
				label="Board scenario"
				labelVisible={false}
				onChangeFn={(value) => void controller.selectScenarioFn(value)}
				onInputChangeFn={controller.draft ? controller.setNameFn : undefined}
				options={controller.options}
				renderPreviewFn={() => null}
				value={controller.value}
			/>
			<div className="flex items-center gap-1">
				<Button
					className="size-[var(--ak-control-min-height)] shrink-0 border-0 bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised active:bg-surface-raised"
					disabled={controller.pending}
					title="New scenario slot"
					onClick={controller.createDraftFn}
				>
					<Plus className="size-5" />
				</Button>
				<Button
					className="size-[var(--ak-control-min-height)] shrink-0 border-0 bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised active:bg-surface-raised"
					disabled={controller.draft || controller.pending}
					title="Delete selected scenario"
					onClick={() => void controller.deleteScenarioFn()}
				>
					<Trash2 className="size-4" />
				</Button>
				<Button
					className="size-[var(--ak-control-min-height)] shrink-0 border-0 bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised active:bg-surface-raised"
					disabled={!controller.canSave}
					title="Save current Board state"
					onClick={() => void controller.saveScenarioFn()}
				>
					<Save className="size-4" />
				</Button>
			</div>
			<p className="truncate text-xs text-muted">{controller.message}</p>
			{game === undefined ? null : <BoardGameplayModeControl game={game} />}
			<EditorPageHelp
				content={<Mx label="Editor Board help" />}
				title={<Tx label="Editor Board" />}
			/>
		</header>
	);
};
