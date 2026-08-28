import { EditorAssetOverview } from "~/ui/resource/editor/EditorAssetOverview";

export const EditorAssetOverviewPage = ({ resourceId }: { readonly resourceId: string }) => (
	<EditorAssetOverview resourceId={resourceId} />
);
