import { ArrowRight } from "lucide-react";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { useTranslator } from "~/translation/ui/useTranslator";
import { LinkButtonLink } from "~/ui/ui/LinkButton";
import type { ItemConnectionFilter } from "~/flow/type/ItemConnectionFilter";

/** Keeps collection navigation available even when the overview contains every entry. */
export const ItemCollectionMoreCard = ({
	itemUid,
	sectionId,
	hasMore,
	filter,
}: {
	readonly itemUid: string;
	readonly sectionId: "production" | "merges" | "connections";
	readonly hasMore: boolean;
	readonly filter?: ItemConnectionFilter;
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
	return (
		<EditorRootCard dataUi="EditorItemCollectionMoreCard">
			<div className="flex items-center justify-between gap-4 text-sm">
				{hasMore ? (
					<p className="text-muted">{translator.textFn("More entries are available.")}</p>
				) : null}
				<LinkButtonLink
					className="ml-auto inline-flex shrink-0 items-center gap-1.5"
					to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
					params={{
						projectId: project.projectId,
						itemUid,
						sectionId,
					}}
					search={{
						filter,
					}}
				>
					{translator.textFn("Show all")}
					<ArrowRight className="size-4" />
				</LinkButtonLink>
			</div>
		</EditorRootCard>
	);
};
