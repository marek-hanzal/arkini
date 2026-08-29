import { useRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import { useEffect } from "react";

import { readRendererLifecycleFx } from "~/renderer/lifecycle/readRendererLifecycleFx";
import { openDiagnosticDirectoryFx } from "~/application-diagnostics/openDiagnosticDirectoryFx";
import { toDiagnosticValueFn } from "~/application-diagnostics/fn/toDiagnosticValueFn";
import { writeDiagnosticRecordFx } from "~/application-diagnostics/writeDiagnosticRecordFx";
import { RendererRuntime } from "~/renderer/RendererRuntime";
import { Button, DangerButton } from "~/ui/button/Button";
import { Canvas } from "~/ui/canvas/Canvas";

export namespace RootFatalErrorView {
	export interface Props {
		readonly error: unknown;
	}
}

/** Renders and closes the application from the unrecoverable renderer boundary. */
export const RootFatalErrorView = ({ error }: RootFatalErrorView.Props) => {
	const router = useRouter();

	useEffect(() => {
		console.error("Arkini renderer entered the fatal lifecycle boundary.", error);
		RendererRuntime.runSync(
			writeDiagnosticRecordFx({
				category: [
					"renderer",
					"fatal-boundary",
				],
				event: "root-fatal-error-rendered",
				level: "fatal",
				data: {
					error: toDiagnosticValueFn(error),
				},
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
						<DangerButton
							onClick={() =>
								router.options.context.rendererRuntime.runSync(
									readRendererLifecycleFx().pipe(
										Effect.flatMap((lifecycle) => lifecycle.forceCloseFx),
										Effect.orDie,
									),
								)
							}
						>
							Close Arkini
						</DangerButton>
					</div>
				</section>
			</main>
		</Canvas>
	);
};
