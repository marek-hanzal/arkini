import { useStore } from "@tanstack/react-form";
import { useState } from "react";

import { Button } from "~/ui/button/Button";
import { EditorFormSection } from "~/ui/form/EditorFormSection";
import { EditorInfoTooltip } from "~/ui/form/EditorInfoTooltip";
import { editorInputClassName } from "~/ui/form/EditorInputClassName";
import { EditorProjectStartGrid } from "~/project-authoring/configuration/EditorProjectStartGrid";
import { useEditorProjectFormSession } from "~/project-authoring/configuration/EditorProjectFormContext";

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
				<div className="flex flex-wrap items-end gap-4">
					<div className="grid min-w-72 flex-1 gap-4 md:grid-cols-2">
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
					<div className="hidden h-14 w-px shrink-0 bg-line-strong lg:block" />
					<label className="grid gap-1.5 text-sm">
						<span className="flex items-center gap-1 font-semibold text-foreground">
							Space
							<EditorInfoTooltip content="Enter a Space number, then choose Switch to edit that Space’s starting board below. Other Spaces stay unchanged." />
						</span>
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
			</EditorFormSection>
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
		</div>
	);
};
