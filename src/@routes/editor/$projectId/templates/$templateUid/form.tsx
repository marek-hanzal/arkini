import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { TemplateForm } from "~/template-authoring/ui/TemplateForm";
export const Route = createFileRoute("/editor/$projectId/templates/$templateUid/form")({
	component: () => {
		const { templateUid } = Route.useParams();
		const params = useParams({
			strict: false,
		});
		const project = useEditorProject();
		const template = project.config.templates?.find((entry) => entry.uid === templateUid);
		if (template === undefined && templateUid !== "new") return <p>Template not found.</p>;
		return (
			<TemplateForm
				key={templateUid}
				template={template}
				section={params.sectionId === "board" ? "board" : "general"}
			/>
		);
	},
});
