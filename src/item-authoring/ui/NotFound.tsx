import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Presents one missing canonical item route without duplicating navigation chrome. */
export const NotFound = ({ uid }: { readonly uid: string }) => {
	const project = useEditorProject();
	const translator = useTranslator();
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
				<EditorRootCard className="max-w-lg gap-0 text-center">
					<h1 className="text-xl font-semibold">{translator.textFn("Item not found")}</h1>
					<p className="mt-2 text-sm text-muted">
						{translator.textFn("No saved item has this UID.")} {uid}
					</p>
				</EditorRootCard>
			</section>
		</EditorSectionPage>
	);
};
