import { EditorItemSearchThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useProjectStartItemPickerController } from "~/project-authoring/ui/useProjectStartItemPickerController";
import { ItemSpotlight } from "~/ui/ui/ItemSpotlight";
import { Tx } from "~/translation/ui/Tx";

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
			onCloseFn={props.onCloseFn}
			onSelectItemFn={controller.selectItemFn}
			options={controller.options.map((option) => ({
				artwork: <EditorItemSearchThumbnail item={controller.items[option.id]} />,
				disabled: option.maxCountReached !== undefined,
				disabledReason:
					option.maxCountReached === undefined ? undefined : (
						<>
							<Tx label="Max count reached" /> ·{" "}
							{option.maxCountReached.currentQuantity}/
							{option.maxCountReached.maxCount}
						</>
					),
				itemId: option.id,
				label: option.label,
				secondary: option.meta ?? option.id,
				terms: option.terms,
			}))}
			placement="viewport"
		/>
	);
};
