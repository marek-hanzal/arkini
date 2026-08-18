import { EditorGameFlow } from "~/ui/item/editor/EditorGameFlow";
import type { EditorOriginFlowDirection } from "~/ui/item/editor/readEditorOriginFlowHighlightFx";

export const EditorFlowPage = ({
	direction,
	itemId,
}: {
	readonly direction: EditorOriginFlowDirection;
	readonly itemId?: string;
}) => (
	<EditorGameFlow
		direction={direction}
		itemId={itemId}
	/>
);
