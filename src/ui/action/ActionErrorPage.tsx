import type { PropsWithChildren } from "react";
import { Button, PrimaryButton } from "~/ui/button/Button";
import { LauncherScene } from "~/ui/launcher/LauncherScene";
import { actionPanelViewTransitionName } from "~/ui/navigation/actionPanelViewTransitionName";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export namespace ActionErrorPage {
	export interface Props extends PropsWithChildren {
		readonly error: unknown;
		readonly reset?: () => void;
		readonly resetLabel?: string;
		readonly description: string;
		readonly onBack?: () => void;
		readonly title: string;
	}
}

/** Keeps one route-action failure visible with only its explicitly supplied actions. */
export const ActionErrorPage = ({
	description,
	error,
	onBack,
	reset,
	resetLabel = "Retry",
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
				viewTransitionName: actionPanelViewTransitionName,
			}}
		>
			<h1 className="text-lg font-semibold text-danger">{title}</h1>
			<p className="text-sm text-muted">{description}</p>
			<p className="text-xs text-danger">{errorMessage(error)}</p>
			<div className="flex flex-wrap justify-center gap-2">
				{children}
				{reset === undefined ? null : (
					<PrimaryButton onClick={reset}>{resetLabel}</PrimaryButton>
				)}
				{onBack === undefined ? null : <Button onClick={onBack}>Back</Button>}
			</div>
		</section>
	</LauncherScene>
);
