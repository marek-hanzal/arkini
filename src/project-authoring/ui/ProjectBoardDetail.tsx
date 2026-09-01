import { useState } from "react";

import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { EditorSearchCombobox } from "~/editor-control/ui/EditorSearchCombobox";
import { DetailFact, DetailFacts, DetailSection } from "~/item-authoring/ui/DetailDefinition";
import type { Project } from "~/project-authoring/type/Project";
import { ProjectStartGrid } from "~/project-authoring/ui/ProjectStartGrid";

export const ProjectBoardDetail = ({ project }: { readonly project: Project }) => {
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
			<EditorRootCard dataUi="EditorProjectBoardSizeDetailCard">
				<DetailSection title="Board size">
					<DetailFacts columns={3}>
						<DetailFact
							label="Width"
							value={board.width}
						/>
						<DetailFact
							label="Height"
							value={board.height}
						/>
						<DetailFact
							label="Capacity"
							value={board.width * board.height}
						/>
					</DetailFacts>
				</DetailSection>
			</EditorRootCard>
			<EditorRootCard dataUi="EditorProjectSpaceDetailCard">
				<EditorSearchCombobox
					displaySelectedLabel
					emptyLabel="No configured Space matches this search."
					label="Space"
					labelVisible={false}
					options={spaces.map((space) => ({
						id: String(space),
						label: `Space · ${space}`,
						terms: [
							"Space",
							String(space),
						],
					}))}
					renderPreviewFn={() => null}
					value={String(selectedSpace)}
					onChangeFn={(space) => setRequestedSpaceFn(Number(space))}
				/>
			</EditorRootCard>
			<EditorRootCard dataUi="EditorProjectSpacePreviewCard">
				<ProjectStartGrid
					cells={project.config.start.board
						.filter((entry) => entry.space === selectedSpace)
						.map((entry) => ({
							itemId: entry.itemId,
							quantity: entry.quantity ?? 1,
							x: entry.x,
							y: entry.y,
						}))}
					height={board.height}
					items={project.config.items}
					mode="detail"
					width={board.width}
				/>
			</EditorRootCard>
		</div>
	);
};
