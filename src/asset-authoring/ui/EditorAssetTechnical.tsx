import { useTranslator } from "~/translation/ui/useTranslator";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { formatByteSizeFn } from "~/ui/fn/formatByteSizeFn";
import { Fact, FactList } from "~/ui/ui/FactList";
import { useEditorAssetById } from "~/asset-authoring/ui/useEditorAssetById";

export const EditorAssetTechnical = ({ resourceId }: { readonly resourceId: string }) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const resource = useEditorAssetById(resourceId);
	if (resource === undefined) return null;
	return (
		<FactList>
			<Fact
				label={translator.textFn("Resource ID")}
				mono
				value={resource.id}
			/>
			<Fact
				label={translator.textFn("MIME type")}
				mono
				value={resource.mime}
			/>
			<Fact
				label={translator.textFn("Byte size")}
				value={formatByteSizeFn(resource.size)}
			/>
			<Fact
				label={translator.textFn("Project revision")}
				value={String(project.revision)}
			/>
			<Fact
				label={translator.textFn("Package status")}
				value={translator.textFn("Included in current project")}
			/>
		</FactList>
	);
};
