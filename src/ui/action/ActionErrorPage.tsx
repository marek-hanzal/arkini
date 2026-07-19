import type { PropsWithChildren } from "react";
import { Button, DangerButton, PrimaryButton } from "~/ui/button/Button";
import { LauncherScene } from "~/ui/launcher/LauncherScene";
import { routeContentViewTransitionName } from "~/ui/navigation/routeContentViewTransitionName";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export namespace ActionErrorPage {
	export interface Props extends PropsWithChildren {
		readonly error: unknown;
		readonly reset: () => void;
		readonly description: string;
		readonly forceExit?: boolean;
		readonly onBack?: () => void;
		readonly title: string;
	}
}

/** Keeps one failed route action visible until retry or explicit native process policy. */
export const ActionErrorPage = ({
	description,
	error,
	forceExit = false,
	onBack,
	reset,
	title,
	children,
}: ActionErrorPage.Props) => (
	<LauncherScene
		compactHero
		dataUi="ActionErrorPage"
		layout="fixed-hero"
	>
		<section
			className="grid max-w-lg gap-4 rounded-2xl border border-danger/35 bg-surface p-[var(--ak-panel-padding)] text-center shadow-2xl"
			data-ui="ActionErrorPanel"
			style={{
				viewTransitionName: routeContentViewTransitionName,
			}}
		>
			<h1 className="text-lg font-semibold text-danger">{title}</h1>
			<p className="text-sm text-muted">{description}</p>
			<p className="text-xs text-danger">{errorMessage(error)}</p>
			<div className="flex flex-wrap justify-center gap-2">
				{children}
				<PrimaryButton onClick={reset}>Retry</PrimaryButton>
				{onBack === undefined ? null : <Button onClick={onBack}>Back</Button>}
				{forceExit ? (
					<DangerButton onClick={() => window.arkini.lifecycle.forceClose()}>
						Force exit without saving
					</DangerButton>
				) : null}
			</div>
		</section>
	</LauncherScene>
);
