import { Outlet, useParams } from "@tanstack/react-router";

import { GameShell } from "~/ui/shell/GameShell";

export function GameShellPage() {
	const { packageId } = useParams({
		from: "/game/$packageId",
	});
	return (
		<GameShell packageId={packageId}>
			<Outlet />
		</GameShell>
	);
}
