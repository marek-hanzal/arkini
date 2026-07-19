import type { ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";

import { DangerButton } from "~/ui/button/Button";
import { Canvas } from "~/ui/canvas/Canvas";

/** Replaces the renderer after an unrecoverable route or Game Engine ownership failure. */
export const RootFatalErrorPage = ({ error }: ErrorComponentProps) => {
	useEffect(() => {
		console.error("Arkini renderer entered the fatal lifecycle boundary.", error);
	}, [
		error,
	]);

	return (
		<Canvas>
			<main
				className="grid h-full w-full place-items-center p-[var(--ak-viewport-padding)]"
				data-ui="RootFatalErrorPage"
			>
				<section
					className="grid w-full max-w-lg gap-4 rounded-2xl border border-danger/35 bg-surface p-[var(--ak-panel-padding)] text-center shadow-2xl"
					data-ui="RootFatalErrorPanel"
				>
					<h1 className="text-xl font-semibold text-danger">Something critical failed</h1>
					<p className="text-sm text-muted">
						Arkini cannot continue this session. Close the application and start the
						game again.
					</p>
					<DangerButton onClick={() => window.arkini.lifecycle.forceClose()}>
						Close Arkini
					</DangerButton>
				</section>
			</main>
		</Canvas>
	);
};
