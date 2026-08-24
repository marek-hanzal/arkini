import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorBoardGame } from "~/bridge/editor/board/EditorBoardGame";
import { useEditorBoardScenarioToolbar } from "~/ui/board/editor/useEditorBoardScenarioToolbar";
import { Button } from "~/ui/button/Button";
import { editorCollectionActionClassName } from "~/ui/form/EditorCollectionSelector";
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
			className="grid shrink-0 grid-cols-[minmax(16rem,32rem)_auto_minmax(0,1fr)] items-center gap-2 border-b border-line bg-surface px-3 py-2"
			data-ui="EditorBoardScenarioToolbar"
		>
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
					className={editorCollectionActionClassName}
					disabled={controller.pending}
					title="New scenario slot"
					onClick={controller.createDraft}
				>
					<span className="icon-[lucide--plus] size-5" />
				</Button>
				<Button
					className={editorCollectionActionClassName}
					disabled={controller.draft || controller.pending}
					title="Delete selected scenario"
					onClick={() => void controller.deleteScenario()}
				>
					<span className="icon-[lucide--trash-2] size-4" />
				</Button>
				<Button
					className={editorCollectionActionClassName}
					disabled={!controller.canSave}
					title="Save current Board state"
					onClick={() => void controller.saveScenario()}
				>
					<span
						className={`${controller.pending ? "icon-[lucide--loader-circle] animate-spin" : "icon-[lucide--save]"} size-4`}
					/>
				</Button>
			</div>
			<p className="truncate text-xs text-muted">{controller.message}</p>
		</header>
	);
};
