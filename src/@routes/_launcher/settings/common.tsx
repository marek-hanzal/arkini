import { createFileRoute } from "@tanstack/react-router";

import { CommonPage } from "~/page/settings/CommonPage";

export const Route = createFileRoute("/_launcher/settings/common")({
	component: CommonPage,
});
