import { EditorItemSearchThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import type { useEditorItemSpotlightController } from "~/authoring-shell/ui/useEditorItemSpotlightController";
import { ItemSpotlight } from "~/ui/ui/ItemSpotlight";

interface EditorItemSpotlightProps extends useEditorItemSpotlightController.Output {}

/** Presents the Editor-wide item lookup over every project workspace. */
export const EditorItemSpotlight = ({
	closeFn,
	items,
	options,
	selectItemFn,
}: EditorItemSpotlightProps) => (
	<ItemSpotlight
		dataUi="EditorItemSpotlight"
		emptyMessage="No items match this search."
		footer={
			<p className="text-center text-xs text-muted">↑↓ select · Enter open · Esc close</p>
		}
		onCloseFn={closeFn}
		onSelectItemFn={selectItemFn}
		options={options.map((option) => ({
			artwork: <EditorItemSearchThumbnail item={items[option.id]} />,
			itemId: option.id,
			label: option.label,
			secondary: option.meta ?? option.id,
			terms: option.terms,
		}))}
		placement="viewport"
		placeholder="Search item title, ID or type…"
	/>
);
