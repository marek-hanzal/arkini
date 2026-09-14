import { useTranslator } from "~/translation/ui/useTranslator";
import { Tx } from "~/translation/ui/Tx";
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
}: EditorItemSpotlightProps) => {
	const translator = useTranslator();
	return (
		<ItemSpotlight
			dataUi="EditorItemSpotlight"
			emptyMessage={translator.textFn("No items match this search.")}
			footer={
				<p className="text-center text-xs text-muted">
					<Tx label="Item search shortcuts" />
				</p>
			}
			onCloseFn={closeFn}
			onSelectItemFn={selectItemFn}
			options={options.map((option) => ({
				artwork: <EditorItemSearchThumbnail item={items[option.id]} />,
				itemId: option.id,
				label: option.label,
				terms: option.terms,
			}))}
			placement="viewport"
			placeholder={translator.textFn("Search item title, ID or type\u2026")}
		/>
	);
};
