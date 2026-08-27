import { useStore } from "@tanstack/react-form";
import { useState } from "react";

import { Button } from "~/ui/button/Button";
import { EditorFormSection } from "~/ui/form/EditorFormSection";
import { editorInputClassName } from "~/ui/form/EditorInputClassName";
import { EditorProjectStartGrid } from "~/ui/project/editor/EditorProjectStartGrid";
import { useEditorProjectFormSession } from "~/ui/project/editor/EditorProjectFormContext";

export const EditorProjectBoardSection = () => {
	const { form } = useEditorProjectFormSession();
	const width = useStore(form.store, (state) => state.values.board.width);
	const height = useStore(form.store, (state) => state.values.board.height);
	const currentSpace = useStore(form.store, (state) => state.values.start.currentSpace);
	const startBoard = useStore(form.store, (state) => state.values.start.board);
	const [selectedSpace, setSelectedSpace] = useState(currentSpace);
	const [spaceInput, setSpaceInput] = useState(String(currentSpace));
	const requestedSpace = Number(spaceInput);
	const canSwitchSpace =
		spaceInput !== "" && Number.isInteger(requestedSpace) && requestedSpace >= 0;
	const cells = startBoard
		.filter((entry) => entry.space === selectedSpace)
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
				description={`Starting stacks placed in board space ${selectedSpace}. Other spaces are preserved unchanged.`}
				title="Initial board"
			>
				<div className="flex flex-wrap items-end gap-3">
					<label className="grid gap-1.5 text-sm">
						<span className="font-semibold text-foreground">Space</span>
						<input
							type="number"
							value={spaceInput}
							className={`${editorInputClassName} w-28`}
							min={0}
							step={1}
							onChange={(event) => setSpaceInput(event.currentTarget.value)}
						/>
					</label>
					<Button
						disabled={!canSwitchSpace}
						onClick={() => setSelectedSpace(requestedSpace)}
					>
						Switch
					</Button>
				</div>
				<EditorProjectStartGrid
					cells={cells}
					height={height}
					onCellsChange={(nextCells) =>
						form.setFieldValue("start.board", [
							...startBoard.filter((entry) => entry.space !== selectedSpace),
							...nextCells.map((cell) => ({
								...cell,
								space: selectedSpace,
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
