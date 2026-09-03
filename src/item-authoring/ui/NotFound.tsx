import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";

/** Presents one missing canonical item route without duplicating navigation chrome. */
export const NotFound = ({ uid }: { readonly uid: string }) => {
	const project = useEditorProject();
	return (
		<EditorSectionPage
			header={
				<EditorSectionNavigation
					leading={
						<EditorHistoryBackButton
							to="/editor/$projectId/editor/items/list"
							params={{
								projectId: project.projectId,
							}}
						/>
					}
					title={<h1 className="truncate text-xl font-semibold">{uid}</h1>}
				/>
			}
		>
			<section
				className="grid min-h-full place-items-center"
				data-ui="EditorItemNotFound"
			>
				<div className="max-w-lg rounded-2xl border-l-2 border-line-strong bg-surface-raised/60 p-6 text-center">
					<h1 className="text-xl font-semibold">Item not found</h1>
					<p className="mt-2 text-sm text-muted">No saved item owns UID {uid}.</p>
				</div>
			</section>
		</EditorSectionPage>
	);
};
