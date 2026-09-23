import { useTranslator } from "~/translation/ui/useTranslator";
import { useState } from "react";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { EditorSearchCombobox } from "~/editor-control/ui/EditorSearchCombobox";
import type { Project } from "~/project-authoring/type/Project";
import { BoardGrid } from "~/board-authoring/ui/BoardGrid";
import { LinkButtonLink } from "~/ui/ui/LinkButton";
import { EditorValueField } from "~/editor-control/ui/EditorValueField";

export const ProjectBoardDetail = ({ project }: { readonly project: Project }) => {
	const translator = useTranslator();
	const spaces = [
		...new Set([
			project.config.start.currentSpace,
			...project.config.start.spaces.map((entry) => entry.space),
		]),
	].sort((a, b) => a - b);
	const [requestedSpace, setRequestedSpaceFn] = useState(project.config.start.currentSpace);
	const selectedSpace = spaces.includes(requestedSpace) ? requestedSpace : spaces[0]!;
	const uid = project.config.start.spaces.find(
		(entry) => entry.space === selectedSpace,
	)?.templateUid;
	const template = project.config.templates?.find((entry) => entry.uid === uid);
	const size = template ?? project.config.meta.board;
	return (
		<div className="grid gap-6">
			<EditorRootCard
				dataUi="EditorProjectSpaceDetailCard"
				className="grid-cols-2 items-start gap-4"
			>
				<EditorSearchCombobox
					displaySelectedLabel
					emptyLabel={translator.textFn("No configured Space matches this search.")}
					label={translator.textFn("Space")}
					options={spaces.map((space) => ({
						id: String(space),
						label: `${translator.textFn("Space")} · ${space}`,
						terms: [
							String(space),
						],
					}))}
					renderPreviewFn={() => null}
					value={String(selectedSpace)}
					onChangeFn={(space) => setRequestedSpaceFn(Number(space))}
				/>
				<EditorValueField
					as="div"
					label={translator.textFn("Template")}
				>
					{template === undefined ? (
						<p className="flex min-h-[var(--ak-control-min-height)] items-center text-muted">
							{translator.textFn("No template selected")}
						</p>
					) : (
						<div className="flex min-h-[var(--ak-control-min-height)] items-center gap-3">
							<LinkButtonLink
								to="/editor/$projectId/templates/$templateUid/detail/$sectionId"
								params={{
									projectId: project.projectId,
									templateUid: template.uid,
									sectionId: "general",
								}}
							>
								{template.title}
							</LinkButtonLink>
							<p className="text-sm text-muted">
								{template.width} × {template.height} ={" "}
								{template.width * template.height} · {template.board.length}{" "}
								{translator.textFn("Items")}
							</p>
						</div>
					)}
				</EditorValueField>
			</EditorRootCard>
			<EditorRootCard dataUi="EditorProjectSpacePreviewCard">
				<BoardGrid
					cells={template?.board ?? []}
					height={size.height}
					width={size.width}
					items={project.config.items}
					mode="detail"
					projectId={project.projectId}
				/>
			</EditorRootCard>
		</div>
	);
};
