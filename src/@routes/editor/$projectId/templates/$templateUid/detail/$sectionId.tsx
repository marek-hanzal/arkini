import { createFileRoute, redirect } from "@tanstack/react-router";
import { TemplateDetail } from "~/template-authoring/ui/TemplateDetail";
export const Route = createFileRoute("/editor/$projectId/templates/$templateUid/detail/$sectionId")(
	{
		beforeLoad: ({ params }) => {
			if (
				[
					"general",
					"board",
					"delete",
				].includes(params.sectionId)
			)
				return;
			throw redirect({
				to: "/editor/$projectId/templates/$templateUid/detail/$sectionId",
				params: {
					...params,
					sectionId: "general",
				},
				replace: true,
			});
		},
		component: () => {
			const { templateUid, sectionId } = Route.useParams();
			return (
				<TemplateDetail
					key={templateUid}
					templateUid={templateUid}
					section={
						sectionId === "board"
							? "board"
							: sectionId === "delete"
								? "delete"
								: "general"
					}
				/>
			);
		},
	},
);
