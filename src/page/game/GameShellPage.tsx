import { Outlet } from "@tanstack/react-router";
import { GameShell } from "~/ui/shell/GameShell";

export function GameShellPage() {
	return (
		<GameShell>
			<Outlet />
		</GameShell>
	);
}
