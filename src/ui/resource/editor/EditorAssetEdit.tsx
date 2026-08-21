import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { Exit } from "effect";
import { useCallback, useRef, useState } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { editEditorAssetCommandAtom } from "~/bridge/resource/editor/editEditorAssetCommandAtom";
import { validateEditorAssetDraftFx } from "~/bridge/resource/editor/validateEditorAssetDraftFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { ButtonLink, PrimaryButton } from "~/ui/button/Button";
import { EditorSectionNavigation } from "~/ui/editor/EditorSectionNavigation";
import { EditorSectionPage } from "~/ui/editor/EditorSectionPage";
import { editorBackLinkClassName, EditorBackIcon } from "~/ui/editor/EditorBackIcon";
import { editorInputClassName } from "~/ui/form/EditorInputClassName";
import { EditorFormContent } from "~/ui/form/EditorFormContent";
import { readSettledAsyncResultErrorFx } from "~/ui/reactivity/readSettledAsyncResultError";
import { EditorAssetImageDropZone } from "~/ui/resource/editor/EditorAssetImageDropZone";
import { useEditorAssetById } from "~/ui/resource/editor/useEditorAssetById";
import { useEditorResourceUrl } from "~/ui/resource/editor/useEditorResourceUrl";
import { Status } from "~/ui/status/Status";
import { useEditorUnsavedChangesRegistration } from "~/ui/editor/useEditorUnsavedChangesRegistration";

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
	const commandAtom = editEditorAssetCommandAtom(project.projectId);
	const result = useAtomValue(commandAtom);
	const mutate = useAtomSet(commandAtom, {
		mode: "promise",
	});
	const [nextId, setNextId] = useState(resourceId);
	const [file, setFile] = useState<File>();
	const dirty = nextId.trim() !== resourceId || file !== undefined;
	const dirtyRef = useRef(dirty);
	dirtyRef.current = dirty;
	const persist = useCallback(async () => {
		if (!dirty || result.waiting) return false;
		const id = nextId.trim();
		await mutate({
			currentId: resourceId,
			file,
			resourceId: id,
		});
		dirtyRef.current = false;
		setNextId(id);
		setFile(undefined);
		return true;
	}, [
		dirty,
		file,
		mutate,
		nextId,
		resourceId,
		result.waiting,
	]);
	const save = useCallback(async () => {
		if (!(await persist())) return false;
		const id = nextId.trim();
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
		filter,
		navigate,
		nextId,
		persist,
		project.projectId,
		query,
	]);
	useEditorUnsavedChangesRegistration(`asset:${project.projectId}:${resourceId}`, {
		discard: () => {
			dirtyRef.current = false;
			setNextId(resourceId);
			setFile(undefined);
		},
		isDirty: () => dirtyRef.current,
		isValid: async () =>
			Exit.isSuccess(
				await RendererRuntime.runPromiseExit(
					validateEditorAssetDraftFx({
						file,
						resourceId: nextId,
					}),
				),
			),
		ownsPathname: (pathname) =>
			pathname.startsWith(`/editor/${project.projectId}/assets/${resourceId}/edit`),
		save: persist,
	});
	const error = RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
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
							className={editorBackLinkClassName}
						>
							<EditorBackIcon />
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
			<EditorFormContent
				className="mx-auto max-w-3xl"
				error={error}
				save={save}
			>
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
			</EditorFormContent>
		</EditorSectionPage>
	);
};
