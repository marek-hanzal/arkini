import { useStore } from "@tanstack/react-form";

import { EditorFormSection } from "~/ui/form/EditorFormSection";
import { EditorProjectStartGrid } from "~/ui/project/editor/EditorProjectStartGrid";
import { useEditorProjectFormSession } from "~/ui/project/editor/EditorProjectFormContext";

export const EditorProjectBoardSection = () => {
	const { form, project } = useEditorProjectFormSession();
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
	const findIndex = (x: number, y: number) =>
		startBoard.findIndex(
			(entry) => entry.space === currentSpace && entry.x === x && entry.y === y,
		);
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
					scope="board"
					width={width}
					onSet={(x, y, itemId) =>
						form.setFieldValue("start.board", [
							...startBoard,
							{
								itemId,
								quantity: 1,
								space: currentSpace,
								x,
								y,
							},
						])
					}
					onIncrement={(x, y) => {
						const index = findIndex(x, y);
						const current = startBoard[index];
						if (current === undefined) return;
						const maxStackSize =
							project.config.items[current.itemId]?.maxStackSize ?? 1;
						if (current.quantity >= maxStackSize) return;
						form.setFieldValue(
							"start.board",
							startBoard.map((entry, candidateIndex) =>
								candidateIndex === index
									? {
											...entry,
											quantity: entry.quantity + 1,
										}
									: entry,
							),
						);
					}}
					onDecrement={(x, y) => {
						const index = findIndex(x, y);
						const current = startBoard[index];
						if (current === undefined) return;
						form.setFieldValue(
							"start.board",
							current.quantity <= 1
								? startBoard.filter((_, candidateIndex) => candidateIndex !== index)
								: startBoard.map((entry, candidateIndex) =>
										candidateIndex === index
											? {
													...entry,
													quantity: entry.quantity - 1,
												}
											: entry,
									),
						);
					}}
				/>
			</EditorFormSection>
		</div>
	);
};
