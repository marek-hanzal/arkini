import { useStore } from "@tanstack/react-form";
import { useEffect, useState } from "react";

import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { editorInputClassName } from "~/editor-control/constant/EditorInputClassName";
import { ProjectStartGrid } from "~/project-authoring/ui/ProjectStartGrid";
import { useProjectFormSession } from "~/project-authoring/ui/ProjectFormContext";
import { ProjectGridSizeValue } from "~/project-authoring/ui/ProjectGridSizeValue";
import { EditorProjectSizeMax } from "~/project-authoring/schema/ProjectFormSchema";

const MaxEditorSpaceIndex = 31;

export const ProjectBoardSection = () => {
	const { form, validationIssues } = useProjectFormSession();
	const width = useStore(form.store, (state) => state.values.board.width);
	const height = useStore(form.store, (state) => state.values.board.height);
	const start = useStore(form.store, (state) => state.values.start);
	const currentSpace = start.currentSpace;
	const startBoard = start.board;
	const [selectedSpace, setSelectedSpaceFn] = useState(currentSpace);
	const [spaceInput, setSpaceInputFn] = useState(String(currentSpace));
	const invalidEntries = validationIssues.flatMap((issue) => {
		const [head, scope, index] = issue.path;
		if (head !== "start" || scope !== "board" || typeof index !== "number") return [];
		const entry = startBoard[index];
		return entry === undefined
			? []
			: [
					entry,
				];
	});
	const firstInvalidSpace = invalidEntries[0]?.space;
	useEffect(() => {
		if (firstInvalidSpace === undefined) return;
		setSelectedSpaceFn(firstInvalidSpace);
		setSpaceInputFn(String(firstInvalidSpace));
	}, [
		firstInvalidSpace,
	]);
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
			<EditorFormSection title="Board size">
				<EditorFormCard>
					<div className="flex flex-wrap items-end gap-4">
						<div className="grid min-w-72 flex-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem]">
							<form.AppField name="board.width">
								{(field) => (
									<field.NumberField
										label="Width"
										max={EditorProjectSizeMax}
										min={1}
									/>
								)}
							</form.AppField>
							<form.AppField name="board.height">
								{(field) => (
									<field.NumberField
										label="Height"
										max={EditorProjectSizeMax}
										min={1}
									/>
								)}
							</form.AppField>
							<ProjectGridSizeValue
								height={height}
								width={width}
							/>
						</div>
						<div className="hidden h-14 w-px shrink-0 bg-line-strong lg:block" />
						<label className="grid gap-1.5 text-sm">
							<span className="font-semibold text-foreground">Space</span>
							<input
								type="number"
								value={spaceInput}
								className={`${editorInputClassName} w-56`}
								max={MaxEditorSpaceIndex}
								min={0}
								step={1}
								onChange={(event) => {
									const value = event.currentTarget.value;
									setSpaceInputFn(value);
									const space = Number(value);
									if (
										value !== "" &&
										Number.isInteger(space) &&
										space >= 0 &&
										space <= MaxEditorSpaceIndex
									)
										setSelectedSpaceFn(space);
								}}
							/>
						</label>
					</div>
				</EditorFormCard>
			</EditorFormSection>
			<ProjectStartGrid
				cells={cells}
				height={height}
				invalidCells={invalidEntries
					.filter((entry) => entry.space === selectedSpace)
					.map(({ x, y }) => ({
						x,
						y,
					}))}
				mode="edit"
				onCellsChangeFn={(nextCells) =>
					form.setFieldValue("start.board", [
						...startBoard.filter((entry) => entry.space !== selectedSpace),
						...nextCells.map((cell) => ({
							...cell,
							space: selectedSpace,
						})),
					])
				}
				scope="board"
				start={start}
				width={width}
			/>
		</div>
	);
};
