import { EditorAssetDeleteSection } from "~/ui/resource/editor/EditorAssetDeleteSection";

export namespace EditorAssetDeletePage {
	export interface Props extends EditorAssetDeleteSection.Props {}
}

export const EditorAssetDeletePage = (props: EditorAssetDeletePage.Props) => (
	<EditorAssetDeleteSection {...props} />
);
