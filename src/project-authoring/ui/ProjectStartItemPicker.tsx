import { EditorItemSearchThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useProjectStartItemPickerController } from "~/project-authoring/ui/useProjectStartItemPickerController";
import { ItemSpotlight } from "~/ui/ui/ItemSpotlight";

interface ProjectStartItemPickerProps extends useProjectStartItemPickerController.Props {}

/** Selects one canonical item allowed in the requested initial grid scope. */
export const ProjectStartItemPicker = (props: ProjectStartItemPickerProps) => {
	const controller = useProjectStartItemPickerController(props);
	return (
		<ItemSpotlight
			dataUi="EditorProjectStartItemPicker"
			emptyMessage="No items can be placed here."
			footer={
				<p className="text-center text-xs text-muted">
					↑↓ select · Enter choose · Esc close
				</p>
			}
			onClose={props.onClose}
			onSelectItem={controller.selectItem}
			options={controller.options.map((option) => ({
				artwork: <EditorItemSearchThumbnail item={controller.items[option.id]} />,
				itemId: option.id,
				label: option.label,
				secondary: option.meta ?? option.id,
				terms: option.terms,
			}))}
			placement="viewport"
		/>
	);
};
