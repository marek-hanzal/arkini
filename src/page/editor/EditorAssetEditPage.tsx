import { EditorAssetEdit } from "~/ui/resource/editor/EditorAssetEdit";

export const EditorAssetEditPage = (props: {
	readonly filter: "all" | "unused";
	readonly query: string;
	readonly resourceId: string;
}) => <EditorAssetEdit {...props} />;
