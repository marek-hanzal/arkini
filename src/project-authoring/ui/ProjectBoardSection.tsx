import { useTranslator } from "~/translation/ui/useTranslator";
import { useStore } from "@tanstack/react-form";
import { useEffect, useState } from "react";
import { BoardGrid } from "~/board-authoring/ui/BoardGrid";
import { useProjectFormSession } from "~/project-authoring/ui/ProjectFormContext";
import { TemplateSelector } from "~/template-authoring/ui/TemplateSelector";
import { EditorNumberControl } from "~/editor-control/ui/EditorValueControls";
import { Status } from "~/ui/ui/Status";
import { PanelsTopLeft } from "lucide-react";

export const ProjectBoardSection = () => {
	const translator = useTranslator();
	const { form, validationIssues } = useProjectFormSession();
	const start = useStore(form.store, (state) => state.values.start);
	const templates = useStore(form.store, (state) => state.values.templates);
	const [selectedSpace, setSelectedSpaceFn] = useState(start.currentSpace);
	const templateUid = start.spaces.find((entry) => entry.space === selectedSpace)?.templateUid;
	const template = templates.find((entry) => entry.uid === templateUid);
	const firstIssue = validationIssues.find(
		(issue) => issue.path[0] === "start" || issue.path[0] === "templates",
	);
	const invalidIndex = firstIssue?.path[0] === "start" ? firstIssue.path[2] : undefined;
	const invalidTemplateIndex =
		firstIssue?.path[0] === "templates" ? firstIssue.path[1] : undefined;
	const invalidSpace =
		typeof invalidIndex === "number"
			? start.spaces[invalidIndex]?.space
			: typeof invalidTemplateIndex === "number"
				? start.spaces.find(
						(entry) => entry.templateUid === templates[invalidTemplateIndex]?.uid,
					)?.space
				: undefined;
	useEffect(() => {
		if (invalidSpace !== undefined) setSelectedSpaceFn(invalidSpace);
	}, [
		invalidSpace,
	]);
	return (
		<div
			className="grid gap-6"
			data-ui="ProjectBoardSection"
		>
			<div className="grid grid-cols-2 items-start gap-4">
				<EditorNumberControl
					label={translator.textFn("Space")}
					min={0}
					value={selectedSpace}
					onChangeFn={(space) => {
						if (Number.isSafeInteger(space) && space >= 0) setSelectedSpaceFn(space);
					}}
				/>
				<TemplateSelector
					templates={templates}
					value={templateUid ?? ""}
					error={firstIssue?.message}
					onChangeFn={(uid) =>
						form.setFieldValue(
							"start.spaces",
							[
								...start.spaces.filter((entry) => entry.space !== selectedSpace),
								...(uid === ""
									? []
									: [
											{
												space: selectedSpace,
												templateUid: uid,
											},
										]),
							].sort((left, right) => left.space - right.space),
						)
					}
				/>
			</div>
			{template === undefined ? (
				<Status
					icon={PanelsTopLeft}
					variant="flat"
					title={translator.textFn("No template selected")}
					description={translator.textFn(
						"Select a template for this Space. Unassigned spaces start empty.",
					)}
				/>
			) : (
				<BoardGrid
					key={template.uid}
					cells={template.board}
					height={template.height}
					width={template.width}
					mode="edit"
					onCellsChangeFn={(cells) =>
						form.setFieldValue(
							"templates",
							templates.map((entry) =>
								entry.uid === template.uid
									? {
											...entry,
											board: [
												...cells,
											],
										}
									: entry,
							),
						)
					}
				/>
			)}
		</div>
	);
};
