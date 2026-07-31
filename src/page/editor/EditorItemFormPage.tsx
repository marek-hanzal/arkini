import { EditorItemFormRoute, type EditorItemType } from "~/ui/item/editor/EditorItemFormRoute";

export namespace EditorItemFormPage {
	export type Props =
		| {
				readonly mode: "create";
				readonly itemType: EditorItemType;
				readonly draftId: string;
		  }
		| {
				readonly mode: "edit";
				readonly itemId: string;
		  };
}

export const EditorItemFormPage = (props: EditorItemFormPage.Props) => (
	<EditorItemFormRoute {...props} />
);
