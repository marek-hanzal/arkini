import { EditorAssetUsage } from "~/ui/resource/editor/EditorAssetUsage";

export const EditorAssetUsagePage = ({ resourceId }: { readonly resourceId: string }) => (
	<EditorAssetUsage resourceId={resourceId} />
);
