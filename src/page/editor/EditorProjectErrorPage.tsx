import type { ErrorComponentProps } from "@tanstack/react-router";

import { ButtonLink } from "~/ui/button/Button";

export const EditorProjectErrorPage = ({ error }: ErrorComponentProps) => (
	<main
		className="grid h-dvh place-items-center bg-canvas p-[var(--ak-viewport-padding)] text-foreground"
		data-ui="EditorProjectErrorPage"
	>
		<section className="w-full max-w-xl rounded-2xl border border-danger/40 bg-surface p-6 shadow-2xl">
			<h1 className="text-2xl font-semibold">Editor project could not be opened</h1>
			<p className="mt-3 break-words text-sm leading-6 text-danger">
				{error instanceof Error ? error.message : String(error)}
			</p>
			<div className="mt-6 flex flex-wrap gap-3">
				<ButtonLink to="/editor/welcome">Editor welcome</ButtonLink>
				<ButtonLink to="/main-menu">Main menu</ButtonLink>
			</div>
		</section>
	</main>
);
