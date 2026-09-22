import { useTranslator } from "~/translation/ui/useTranslator";
import { EditorItemSearchThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useProjectStartItemPickerController } from "~/project-authoring/ui/useProjectStartItemPickerController";
import { ItemSpotlight } from "~/ui/ui/ItemSpotlight";
import { Tx } from "~/translation/ui/Tx";

interface ProjectStartItemPickerProps extends useProjectStartItemPickerController.Props {}

/** Selects one canonical item for the initial board. */
export const ProjectStartItemPicker = (props: ProjectStartItemPickerProps) => {
	const translator = useTranslator();
	const controller = useProjectStartItemPickerController(props);
	return (
		<ItemSpotlight
			dataUi="EditorProjectStartItemPicker"
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
