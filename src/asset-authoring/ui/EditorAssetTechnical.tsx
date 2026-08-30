import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { formatByteSizeFn } from "~/ui/fn/formatByteSizeFn";
import { Fact, FactList } from "~/ui/fact/FactList";
import { useEditorAssetById } from "~/asset-authoring/ui/useEditorAssetById";

export const EditorAssetTechnical = ({ resourceId }: { readonly resourceId: string }) => {
	const project = useEditorProject();
	const resource = useEditorAssetById(resourceId);
	if (resource === undefined) return null;
	return (
		<FactList>
			<Fact
				label="Resource ID"
				mono
				value={resource.id}
			/>
			<Fact
				label="MIME type"
				mono
				value={resource.mime}
			/>
			<Fact
				label="Byte size"
				value={formatByteSizeFn(resource.bytes.byteLength)}
			/>
			<Fact
				label="Project revision"
				value={String(project.revision)}
			/>
			<Fact
				label="Package status"
				value="Included in current project"
			/>
		</FactList>
	);
};
