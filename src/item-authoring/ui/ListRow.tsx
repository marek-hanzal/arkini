import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ButtonLink } from "~/ui/ui/Button";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { selectableClassName } from "~/ui/constant/SelectableStateClassName";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";

/** Presents one saved item and owns its type-filter affordance. */
export const ListRow = ({
	activeType,
	item,
	onSelectTypeFn,
	projectId,
}: {
	readonly activeType: ItemSchema.Type["type"] | undefined;
	readonly item: ItemSchema.Type;
	readonly onSelectTypeFn: (type: ItemSchema.Type["type"]) => void;
	readonly projectId: string;
}) => (
	<article
		className="ak-list-row ak-list-row-interactive flex min-w-0 items-center gap-4 rounded-xl p-3"
		data-item-id={item.id}
		data-item-uid={item.uid}
		data-ui="EditorItemRow"
	>
		<ButtonLink
			to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
			params={{
				projectId,
				itemUid: item.uid,
				sectionId: "identity",
			}}
			className="min-h-0 min-w-0 flex-1 justify-start gap-4 border-0 bg-transparent p-0 text-left shadow-none before:absolute before:inset-0 before:content-[''] hover:bg-transparent"
		>
			<EditorItemThumbnail resourceIds={item.asset.default} />
			<span className="min-w-0 flex-1">
				<span className="block truncate text-base font-semibold">{item.title}</span>
				<span className="mt-1 block truncate text-xs text-subtle">{item.id}</span>
			</span>
		</ButtonLink>
		<button
			type="button"
			className={`relative z-10 shrink-0 cursor-pointer rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider ${selectableClassName}`}
			onClick={() => onSelectTypeFn(item.type)}
			{...readDataUiFn({
				dataUi: "EditorItemTypeFilter",
				state: {
					selected: activeType === item.type,
				},
			})}
		>
			{item.type}
		</button>
	</article>
);
