import type { PropsWithChildren } from "react";

export function GameShell({ children }: PropsWithChildren) {
	return (
		<main
			className="min-h-dvh bg-slate-950 text-slate-100"
			data-ui="GameShell"
		>
			{children}
		</main>
	);
}
