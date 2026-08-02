import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { editEditorAssetCommandAtom } from "~/bridge/resource/editor/editEditorAssetCommandAtom";
import { ButtonLink, PrimaryButton } from "~/ui/button/Button";
import { EditorSectionNavigation } from "~/ui/editor/EditorSectionNavigation";
import { EditorSectionPage } from "~/ui/editor/EditorSectionPage";
import { editorInputClassName } from "~/ui/form/EditorInputClassName";
import { readSettledAsyncResultError } from "~/ui/reactivity/readSettledAsyncResultError";
import { EditorAssetImageDropZone } from "~/ui/resource/editor/EditorAssetImageDropZone";
import { useEditorAssetById } from "~/ui/resource/editor/useEditorAssetById";
import { useEditorResourceUrl } from "~/ui/resource/editor/useEditorResourceUrl";
import { Status } from "~/ui/status/Status";

export const EditorAssetEdit = ({
	filter,
	query,
	resourceId,
}: {
	readonly filter: "all" | "unused";
	readonly query: string;
	readonly resourceId: string;
}) => {
	const project = useEditorProject();
	const resource = useEditorAssetById(resourceId);
	const currentUrl = useEditorResourceUrl(resourceId);
	const navigate = useNavigate();
	const result = useAtomValue(editEditorAssetCommandAtom);
	const mutate = useAtomSet(editEditorAssetCommandAtom, {
		mode: "promise",
	});
	const [nextId, setNextId] = useState(resourceId);
	const [file, setFile] = useState<File>();
	const dirty = nextId.trim() !== resourceId || file !== undefined;
	const save = useCallback(async () => {
		if (!dirty || result.waiting) return false;
		const id = nextId.trim();
		await mutate({
			currentId: resourceId,
			file,
			projectId: project.projectId,
			resourceId: id,
		});
		await navigate({
			to: "/editor/$projectId/assets/$resourceId/detail/overview",
			params: {
				projectId: project.projectId,
				resourceId: id,
			},
			search: {
				filter,
				query,
			},
			replace: true,
		});
		return true;
	}, [
		dirty,
		file,
		filter,
		mutate,
		navigate,
		nextId,
		project.projectId,
		query,
		resourceId,
		result.waiting,
	]);
	const error = readSettledAsyncResultError(result);
	if (resource === undefined)
		return (
			<Status
				dataUi="EditorAssetNotFound"
				description={`Resource ${resourceId} is not present in this project.`}
				icon="icon-[lucide--file-question]"
				title="Asset not found"
			/>
		);
	return (
		<EditorSectionPage
			tabs={
				<EditorSectionNavigation
					leading={
						<ButtonLink
							to="/editor/$projectId/assets/$resourceId/detail/overview"
							params={{
								projectId: project.projectId,
								resourceId,
							}}
							search={{
								filter,
								query,
							}}
							className="min-h-0 px-3 py-2"
						>
							<span className="icon-[lucide--arrow-left] size-4" />
						</ButtonLink>
					}
					title={<h1 className="truncate text-xl font-semibold">Edit {resourceId}</h1>}
					action={
						<PrimaryButton
							disabled={!dirty || result.waiting}
							cursorIntent={result.waiting ? "progress" : undefined}
							className="min-h-0 px-4 py-2 text-sm"
							onClick={() => void save()}
						>
							{result.waiting ? "Saving…" : "Save"}
						</PrimaryButton>
					}
				/>
			}
		>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					void save();
				}}
			>
				<div className="mx-auto grid max-w-3xl gap-5">
					{error === undefined ? null : (
						<p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
							{error instanceof Error ? error.message : String(error)}
						</p>
					)}
					<label className="grid gap-1.5 text-sm font-semibold">
						Asset ID
						<input
							className={editorInputClassName}
							value={nextId}
							onChange={(event) => setNextId(event.currentTarget.value)}
						/>
					</label>
					<EditorAssetImageDropZone
						currentUrl={currentUrl}
						file={file}
						onFile={setFile}
					/>
				</div>
			</form>
		</EditorSectionPage>
	);
};
