import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

/** Keeps the item identity and its complete artwork together in detail and form headers. */
export const ItemHeaderTitle = ({
	resourceUids,
	title,
}: {
	readonly resourceUids: ItemSchema.Type["artwork"]["default"];
	readonly title: string;
}) => (
	<h1
		className="flex min-w-0 items-center gap-2 text-xl font-semibold"
		data-ui="EditorItemHeaderTitle"
	>
		<EditorItemThumbnail
			className="size-10 rounded-none border-0 bg-transparent"
			resourceUids={resourceUids}
		/>
		<span className="shrink-0 text-subtle">·</span>
		<span className="truncate">{title}</span>
	</h1>
);
