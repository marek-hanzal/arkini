import type { EditorSelector } from "~/bridge/item/editor/EditorItemModel";

/** Presents one authored item selector in editor detail copy. */
export const EditorSelectorDetail = ({ selector }: { readonly selector: EditorSelector }) => (
	<>Item {selector.itemId}</>
);
