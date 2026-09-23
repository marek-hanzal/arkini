import { useTranslator } from "~/translation/ui/useTranslator";
import { useState } from "react";

import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { EditorSearchCombobox } from "~/editor-control/ui/EditorSearchCombobox";
import type { Project } from "~/project-authoring/type/Project";
import { BoardGrid } from "~/board-authoring/ui/BoardGrid";

export const ProjectBoardDetail = ({ project }: { readonly project: Project }) => {
	const translator = useTranslator();
	const { board } = project.config.meta;
	const spaces = [
		...new Set([
			project.config.start.currentSpace,
			...project.config.start.board.map((entry) => entry.space),
		]),
	].sort((left, right) => left - right);
	const [requestedSpace, setRequestedSpaceFn] = useState(project.config.start.currentSpace);
	const selectedSpace = spaces.includes(requestedSpace)
		? requestedSpace
		: (spaces[0] ?? project.config.start.currentSpace);
	return (
		<div className="grid gap-6">
			<EditorRootCard dataUi="EditorProjectSpaceDetailCard">
				<EditorSearchCombobox
					displaySelectedLabel
					emptyLabel={translator.textFn("No configured Space matches this search.")}
					label={translator.textFn("Space")}
					options={spaces.map((space) => ({
						id: String(space),
						label: `${translator.textFn("Space")} · ${space}`,
						terms: [
							translator.textFn("Space"),
							String(space),
						],
					}))}
					renderPreviewFn={() => null}
					value={String(selectedSpace)}
					onChangeFn={(space) => setRequestedSpaceFn(Number(space))}
				/>
			</EditorRootCard>
			<EditorRootCard dataUi="EditorProjectSpacePreviewCard">
				<BoardGrid
					cells={project.config.start.board
						.filter((entry) => entry.space === selectedSpace)
						.map((entry) => ({
							itemId: entry.itemId,
							x: entry.x,
							y: entry.y,
						}))}
					height={board.height}
					items={project.config.items}
					mode="detail"
					projectId={project.projectId}
					width={board.width}
				/>
			</EditorRootCard>
		</div>
	);
};
