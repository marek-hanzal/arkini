import { useEffect } from "react";

import { openDiagnosticDirectoryFx } from "~/application-diagnostics/fx/openDiagnosticDirectoryFx";
import { writeApplicationLogFx } from "~/application-diagnostics/fx/writeApplicationLogFx";
import { formatApplicationDiagnosticTextFn } from "~/application-diagnostics/fn/formatApplicationDiagnosticTextFn";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { Button, DangerButton } from "~/ui/ui/Button";
import { Canvas } from "~/ui/ui/Canvas";

interface RootFatalErrorViewProps {
	readonly error: unknown;
	readonly onCloseFn: () => void;
}

/** Renders and closes the application from the unrecoverable renderer boundary. */
export const RootFatalErrorView = ({ error, onCloseFn }: RootFatalErrorViewProps) => {
	useEffect(() => {
		console.error("Arkini renderer entered the fatal lifecycle boundary.", error);
		RendererRuntime.runSync(
			writeApplicationLogFx({
				level: "fatal",
				message: "Renderer entered the fatal boundary",
				body: formatApplicationDiagnosticTextFn({
					value: error,
					prefix: "Boundary: renderer root",
				}),
			}),
		);
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
					<div className="flex flex-wrap justify-center gap-3">
						<Button
							onClick={() => {
								void RendererRuntime.runPromise(openDiagnosticDirectoryFx()).catch(
									(cause) => {
										console.error("Arkini could not open diagnostics.", cause);
									},
								);
							}}
						>
							Open diagnostics
						</Button>
						<DangerButton onClick={onCloseFn}>Close Arkini</DangerButton>
					</div>
				</section>
			</main>
		</Canvas>
	);
};
