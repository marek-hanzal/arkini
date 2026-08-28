import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import { twMerge } from "tailwind-merge";
import { ButtonLink } from "~/ui/button/Button";
import { EditorItemThumbnail } from "~/ui/item/editor/EditorItemThumbnail";
import type { EditorItemSectionId } from "~/ui/item/editor/EditorItemSections";

/** Links one known item reference to its canonical identity detail. */
export const EditorItemDetailReference = ({
	className,
	item,
	projectId,
	sectionId = "identity",
}: {
	readonly className?: string;
	readonly item: EditorItem;
	readonly projectId: string;
	readonly sectionId?: EditorItemSectionId;
}) => (
	<ButtonLink
		to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
		params={{
			itemUid: item.uid,
			projectId,
			sectionId,
		}}
		className={twMerge(
			"group min-h-0 min-w-0 justify-start gap-3 border-0 bg-transparent p-0 text-left shadow-none hover:bg-transparent",
			className,
		)}
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
