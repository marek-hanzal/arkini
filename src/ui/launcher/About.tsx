import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { useExclusiveAction } from "~/ui/action/useExclusiveAction";
import { BackButton } from "~/ui/button/BackButton";

/** Renders project and authorship credits for the normalized About page. */
export const About = () => {
	const errorMessage = (error: unknown) =>
		error instanceof Error ? error.message : String(error);
	const navigate = useNavigate();
	const mountedRef = useRef(false);
	const [navigationError, setNavigationError] = useState<unknown>();
	const { active, claim, release } = useExclusiveAction<"exit">();
	const exitPending = active === "exit";

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const requestMainMenu = useCallback(() => {
		if (!claim("exit")) return;
		setNavigationError(undefined);
		void (async () => {
			try {
				await navigate({
					to: "/main-menu",
				});
			} catch (error) {
				if (mountedRef.current) setNavigationError(error);
			} finally {
				release("exit");
			}
		})();
	}, [
		claim,
		navigate,
		release,
	]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			requestMainMenu();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		requestMainMenu,
	]);

	return (
		<div
			className="relative isolate"
			data-ui="About"
		>
			<div className="relative z-10 grid gap-4 text-center">
				<h1
					id="about-title"
					className="text-2xl font-semibold"
				>
					About Arkini
				</h1>
				<p className="leading-7 text-muted">
					Arkini is a merge-economy game about building production chains, discovering
					recipes and shaping a living board-sized world.
				</p>
				<section
					className="border-t border-line pt-4 text-left"
					aria-label="Project credits"
				>
					<p className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">
						Project credits
					</p>
					<p className="mt-2 text-sm leading-6 text-muted">
						Arkini is being forged through the hard work of ChatGPT-5.6, standing on the
						the blood-soaked work of ChatGPT-5.4 and ChatGPT-5.5, whose heroic suffering
						produced the original v0; Marek Hanzal, serving as chief mega-nag,
						relentless tormentor, and supreme authority on whether anything is actually
						good enough; and with inspiration from his wife, Šárka Hanušová.
					</p>
				</section>
				{navigationError === undefined ? null : (
					<p className="text-sm text-danger">
						Navigation failed: {errorMessage(navigationError)}
					</p>
				)}
				<BackButton
					cursorIntent={exitPending ? "progress" : undefined}
					disabled={exitPending}
					onClick={requestMainMenu}
				>
					{exitPending ? "Returning…" : "Back"}
				</BackButton>
			</div>
		</div>
	);
};
