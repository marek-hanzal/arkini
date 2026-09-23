import { useEditorUnsavedChangesOwner } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { TemplateSectionBar } from "~/template-authoring/ui/TemplateSectionBar";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { useNavigate } from "@tanstack/react-router";
import { BoardGrid } from "~/board-authoring/ui/BoardGrid";
import { EditorFormSectionPage } from "~/editor-control/ui/EditorFormSectionPage";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorTextControl, EditorNumberControl } from "~/editor-control/ui/EditorValueControls";
import { useTranslator } from "~/translation/ui/useTranslator";
import { useTemplateFormController } from "~/template-authoring/ui/useTemplateFormController";
import type { TemplateSchema } from "~/board-template/schema/TemplateSchema";

export const TemplateForm = ({
	template,
	section,
}: {
	readonly template?: TemplateSchema.Type;
	readonly section: "general" | "board";
}) => {
	const navigateFn = useNavigate();
	const translator = useTranslator();
	const unsavedChanges = useEditorUnsavedChangesOwner();
	const controller = useTemplateFormController({
		template,
		onSavedFn: (templateUid) =>
			navigateFn({
				to: "/editor/$projectId/templates/$templateUid/detail/$sectionId",
				params: {
					projectId: controller.project.projectId,
					templateUid,
					sectionId: section,
				},
				replace: true,
			}),
	});
	const { project, value, setValueFn, dirty, saving, saveFn, error, issues } = controller;
	const fieldErrorFn = (name: string) => issues.find((issue) => issue.path[0] === name)?.message;
	return (
		<EditorFormSectionPage
			secondaryNavigation={
				<TemplateSectionBar
					section={section}
					projectId={project.projectId}
					templateUid={template?.uid ?? "new"}
					destination="form"
				/>
			}
			leading={
				<EditorHistoryBackButton
					to={
						template === undefined
							? "/editor/$projectId/templates"
							: "/editor/$projectId/templates/$templateUid/detail/$sectionId"
					}
					params={{
						projectId: project.projectId,
						templateUid: template?.uid ?? "new",
						sectionId: section,
					}}
				/>
			}
			title={
				<h1 className="text-xl font-semibold">
					{template?.title ?? translator.textFn("New template")}
				</h1>
			}
			discardFn={async () => {
				const pathname =
					template === undefined
						? `/editor/${project.projectId}/templates`
						: `/editor/${project.projectId}/templates/${template.uid}/detail/${section}`;
				if (!(await unsavedChanges.requestLeaveFn(pathname))) return;
				if (template === undefined) {
					await navigateFn({
						to: "/editor/$projectId/templates",
						params: {
							projectId: project.projectId,
						},
						replace: true,
					});
				} else {
					await navigateFn({
						to: "/editor/$projectId/templates/$templateUid/detail/$sectionId",
						params: {
							projectId: project.projectId,
							templateUid: template.uid,
							sectionId: section,
						},

						replace: true,
					});
				}
			}}
			saveEnabled={dirty || template === undefined}
			saveFn={saveFn}
			saving={saving}
			error={error}
			rootCard={false}
		>
			<div
				className="grid w-full gap-6"
				data-ui="TemplateForm"
			>
				<div className="grid min-w-0 gap-6">
					{section === "general" ? (
						<EditorFormCard>
							<EditorTextControl
								label={translator.textFn("Title")}
								value={value.title}
								error={fieldErrorFn("title")}
								onChangeFn={(title) =>
									setValueFn({
										...value,
										title,
									})
								}
							/>
							<div className="grid grid-cols-2 gap-4">
								<EditorNumberControl
									label={translator.textFn("Width")}
									value={value.width}
									min={1}
									max={42}
									error={fieldErrorFn("width")}
									onChangeFn={(width) =>
										setValueFn({
											...value,
											width,
										})
									}
								/>
								<EditorNumberControl
									label={translator.textFn("Height")}
									value={value.height}
									min={1}
									max={42}
									error={fieldErrorFn("height")}
									onChangeFn={(height) =>
										setValueFn({
											...value,
											height,
										})
									}
								/>
							</div>
						</EditorFormCard>
					) : (
						<>
							{fieldErrorFn("board") === undefined ? null : (
								<p className="text-danger">{fieldErrorFn("board")}</p>
							)}
							{Number.isInteger(value.width) &&
							value.width > 0 &&
							value.width <= 42 &&
							Number.isInteger(value.height) &&
							value.height > 0 &&
							value.height <= 42 ? (
								<BoardGrid
									mode="edit"
									cells={value.board}
									width={value.width}
									height={value.height}
									onCellsChangeFn={(board) =>
										setValueFn({
											...value,
											board: [
												...board,
											],
										})
									}
								/>
							) : null}
						</>
					)}
				</div>
			</div>
		</EditorFormSectionPage>
	);
};
