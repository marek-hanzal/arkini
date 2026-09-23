import { createFileRoute } from "@tanstack/react-router";
import { Templates } from "~/template-authoring/ui/Templates";
export const Route = createFileRoute("/editor/$projectId/templates/")({
	component: Templates,
});
