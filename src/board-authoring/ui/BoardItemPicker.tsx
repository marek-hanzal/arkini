import { useTranslator } from "~/translation/ui/useTranslator";
import { EditorItemSearchThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useBoardItemPickerController } from "~/board-authoring/ui/useBoardItemPickerController";
import { ItemSpotlight } from "~/ui/ui/ItemSpotlight";
import { Tx } from "~/translation/ui/Tx";

interface BoardItemPickerProps extends useBoardItemPickerController.Props {}

/** Selects one canonical item for an authored board. */
export const BoardItemPicker = (props: BoardItemPickerProps) => {
	const translator = useTranslator();
	const controller = useBoardItemPickerController(props);
	return (
		<ItemSpotlight
			dataUi="EditorBoardItemPicker"
			emptyMessage={translator.textFn("No items can be placed here.")}
			footer={
				<p className="text-center text-xs text-muted">
					<Tx label="Item picker keyboard hint" />
				</p>
			}
			onCloseFn={props.onCloseFn}
			onSelectItemFn={controller.selectItemFn}
			options={controller.options.map((option) => ({
				artwork: <EditorItemSearchThumbnail item={controller.items[option.id]} />,
				itemId: option.id,
				label: option.label,
				terms: option.terms,
			}))}
			placement="viewport"
		/>
	);
};
