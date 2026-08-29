import { FileQuestion } from "lucide-react";

import { PrimaryButton } from "~/ui/button/Button";
import { EditorHistoryBackButton } from "~/authoring-shell/navigation/EditorHistoryBackButton";
import { EditorSectionNavigation } from "~/authoring-shell/navigation/EditorSectionNavigation";
import { EditorSectionPage } from "~/authoring-shell/navigation/EditorSectionPage";
import { editorInputClassName } from "~/ui/form/EditorInputClassName";
import { EditorFormContent } from "~/ui/form/EditorFormContent";
import { EditorAssetImageDropZone } from "~/ui/resource/editor/EditorAssetImageDropZone";
import { useEditorAssetEditController } from "~/ui/resource/editor/useEditorAssetEditController";
import { Status } from "~/ui/status/Status";

export namespace EditorAssetEdit {
	export interface Props extends useEditorAssetEditController.Props {}
}

export const EditorAssetEdit = ({ filter, query, resourceId }: EditorAssetEdit.Props) => {
	const controller = useEditorAssetEditController({
		filter,
		query,
		resourceId,
	});
	if (!controller.resourceFound)
		return (
			<Status
				dataUi="EditorAssetNotFound"
				description={`Resource ${resourceId} is not present in this project.`}
				icon={FileQuestion}
				title="Asset not found"
				action={
					<EditorHistoryBackButton
						params={{
							projectId: controller.projectId,
						}}
						search={{
							filter,
							query,
						}}
						to="/editor/$projectId/assets"
					/>
				}
			/>
		);
	return (
		<EditorSectionPage
			tabs={
				<EditorSectionNavigation
					leading={
						<EditorHistoryBackButton
							to="/editor/$projectId/assets/$resourceId/detail/overview"
							params={{
								projectId: controller.projectId,
								resourceId,
							}}
							search={{
								filter,
								query,
							}}
						/>
					}
					title={<h1 className="truncate text-xl font-semibold">Edit {resourceId}</h1>}
					action={
						<PrimaryButton
							disabled={!controller.dirty || controller.saving}
							cursorIntent={controller.saving ? "progress" : undefined}
							className="min-h-0 px-4 py-2 text-sm"
							onClick={() => void controller.save()}
						>
							Save
						</PrimaryButton>
					}
				/>
			}
		>
			<div className="mx-auto w-full max-w-3xl">
				<EditorFormContent
					error={controller.error}
					save={controller.save}
				>
					<label className="grid gap-1.5 text-sm font-semibold">
						Asset ID
						<input
							className={editorInputClassName}
							value={controller.nextId}
							onChange={(event) => controller.setNextId(event.currentTarget.value)}
						/>
					</label>
					<EditorAssetImageDropZone
						currentUrl={controller.currentUrl}
						file={controller.file}
						onFile={controller.setFile}
					/>
				</EditorFormContent>
			</div>
		</EditorSectionPage>
	);
};
