import { useStore } from "@tanstack/react-form";

import { EditorFormSection } from "~/ui/form/EditorFormSection";
import { EditorProjectStartGrid } from "~/ui/project/editor/EditorProjectStartGrid";
import { useEditorProjectFormSession } from "~/ui/project/editor/EditorProjectFormContext";

export const EditorProjectBoardSection = () => {
	const { form } = useEditorProjectFormSession();
	const width = useStore(form.store, (state) => state.values.board.width);
	const height = useStore(form.store, (state) => state.values.board.height);
	const currentSpace = useStore(form.store, (state) => state.values.start.currentSpace);
	const startBoard = useStore(form.store, (state) => state.values.start.board);
	const cells = startBoard
		.filter((entry) => entry.space === currentSpace)
		.map((entry) => ({
			itemId: entry.itemId,
			quantity: entry.quantity,
			x: entry.x,
			y: entry.y,
		}));
	return (
		<div className="grid gap-6">
			<EditorFormSection
				description="The dimensions of every playable board space."
				title="Board size"
			>
				<div className="grid gap-4 md:grid-cols-2">
					<form.AppField name="board.width">
						{(field) => (
							<field.NumberField
								label="Width"
								min={1}
							/>
						)}
					</form.AppField>
					<form.AppField name="board.height">
						{(field) => (
							<field.NumberField
								label="Height"
								min={1}
							/>
						)}
					</form.AppField>
				</div>
			</EditorFormSection>
			<EditorFormSection
				description={`Starting stacks placed in board space ${currentSpace + 1}. Other spaces are preserved unchanged.`}
				title="Initial board"
			>
				<EditorProjectStartGrid
					cells={cells}
					height={height}
					onCellsChange={(nextCells) =>
						form.setFieldValue("start.board", [
							...startBoard.filter((entry) => entry.space !== currentSpace),
							...nextCells.map((cell) => ({
								...cell,
								space: currentSpace,
							})),
						])
					}
					scope="board"
					width={width}
				/>
			</EditorFormSection>
		</div>
	);
};
