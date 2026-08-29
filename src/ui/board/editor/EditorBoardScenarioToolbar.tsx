import { Plus, Save, Trash2 } from "lucide-react";

import type { EditorProject } from "~/editor/EditorProject";
import type { EditorBoardGame } from "~/renderer/editor/board/EditorBoardGame";
import { useEditorBoardScenarioToolbar } from "~/ui/board/editor/useEditorBoardScenarioToolbar";
import { Button } from "~/ui/button/Button";
import { EditorHistoryBackButton } from "~/ui/editor/EditorHistoryBackButton";
import { EditorSearchCombobox } from "~/ui/form/EditorSearchCombobox";

/** Presents the explicit named scenario selector without owning persistence rules. */
export const EditorBoardScenarioToolbar = ({
	game,
	project,
}: {
	readonly game?: EditorBoardGame;
	readonly project: EditorProject;
}) => {
	const controller = useEditorBoardScenarioToolbar({
		game,
		project,
	});
	return (
		<header
			className="grid shrink-0 grid-cols-[auto_minmax(16rem,32rem)_auto_minmax(0,1fr)] items-center gap-2 border-b border-line bg-surface px-3 py-2"
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
				onChange={(value) => void controller.selectScenario(value)}
				onInputChange={controller.draft ? controller.setName : undefined}
				options={controller.options}
				renderPreview={() => null}
				value={controller.value}
			/>
			<div className="flex items-center gap-1">
				<Button
					className="size-[var(--ak-control-min-height)] shrink-0 border-0 bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised active:bg-surface-raised"
					disabled={controller.pending}
					title="New scenario slot"
					onClick={controller.createDraft}
				>
					<Plus className="size-5" />
				</Button>
				<Button
					className="size-[var(--ak-control-min-height)] shrink-0 border-0 bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised active:bg-surface-raised"
					disabled={controller.draft || controller.pending}
					title="Delete selected scenario"
					onClick={() => void controller.deleteScenario()}
				>
					<Trash2 className="size-4" />
				</Button>
				<Button
					className="size-[var(--ak-control-min-height)] shrink-0 border-0 bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised active:bg-surface-raised"
					disabled={!controller.canSave}
					title="Save current Board state"
					onClick={() => void controller.saveScenario()}
				>
					<Save className="size-4" />
				</Button>
			</div>
			<p className="truncate text-xs text-muted">{controller.message}</p>
		</header>
	);
};
