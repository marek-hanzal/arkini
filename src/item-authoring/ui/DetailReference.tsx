import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ButtonLink } from "~/ui/ui/Button";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import type { SectionId } from "~/item-authoring/type/Section";

/** Links one known item reference to its canonical identity detail. */
export const DetailReference = ({
	item,
	projectId,
	sectionId = "identity",
	stretched = false,
}: {
	readonly item: ItemSchema.Type;
	readonly projectId: string;
	readonly sectionId?: SectionId;
	readonly stretched?: boolean;
}) => (
	<ButtonLink
		to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
		params={{
			itemUid: item.uid,
			projectId,
			sectionId,
		}}
		className={`group min-h-0 min-w-0 justify-start gap-3 border-0 bg-transparent p-0 text-left shadow-none hover:bg-transparent${stretched ? " flex-1 before:absolute before:inset-0 before:content-['']" : ""}`}
	>
		<EditorItemThumbnail
			className="rounded-lg border-0 bg-surface/45 ring-1 ring-line/50"
			imageClassName="p-0.5"
			resourceIds={item.asset.default}
			size="sm"
		/>
		<span className="truncate font-medium text-foreground">{item.title}</span>
	</ButtonLink>
);
