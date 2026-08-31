import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import type { SectionId } from "~/item-authoring/type/Section";
import { ButtonLink } from "~/ui/ui/Button";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { ItemTypeFilterButton } from "~/item-authoring/ui/ItemTypeFilterButton";
import type { ReactNode } from "react";

/** Presents one saved item and owns its type-filter affordance. */
export const ListRow = ({
	activeType,
	dataUi = "EditorItemRow",
	details,
	item,
	onSelectTypeFn,
	projectId,
	sectionId = "identity",
}: {
	readonly activeType: TypeSchema.Type | undefined;
	readonly dataUi?: "EditorItemEstimateRow" | "EditorItemRow";
	readonly details?: ReactNode;
	readonly item: ItemSchema.Type;
	readonly onSelectTypeFn: (type: TypeSchema.Type) => void;
	readonly projectId: string;
	readonly sectionId?: SectionId;
}) => (
	<article
		className="ak-list-row ak-list-row-interactive flex min-w-0 items-center gap-4 rounded-xl p-3"
		data-item-id={item.id}
		data-item-uid={item.uid}
		data-ui={dataUi}
	>
		<ButtonLink
			to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
			params={{
				projectId,
				itemUid: item.uid,
				sectionId,
			}}
			className="min-h-0 min-w-0 flex-1 justify-start gap-4 border-0 bg-transparent p-0 text-left shadow-none before:absolute before:inset-0 before:content-[''] hover:bg-transparent"
		>
			<EditorItemThumbnail resourceIds={item.asset.default} />
			<span className="min-w-0 flex-1">
				<span className="block truncate text-base font-semibold">{item.title}</span>
				<span className="mt-1 block truncate text-xs text-subtle">{item.id}</span>
			</span>
		</ButtonLink>
		<ItemTypeFilterButton
			activeType={activeType}
			itemType={item.type}
			onSelectTypeFn={onSelectTypeFn}
		/>
		{details}
	</article>
);
