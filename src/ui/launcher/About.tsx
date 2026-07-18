import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { PrimaryButtonLink } from "~/ui/button/Button";
import { LauncherScene } from "~/ui/launcher/LauncherScene";
import { launcherPanelViewTransitionName } from "~/ui/navigation/launcherPanelViewTransitionName";
import { routeSceneViewTransitionName } from "~/ui/navigation/routeSceneViewTransitionName";

/** Renders concise project and authorship credits as a standalone launcher destination. */
export const About = () => {
	const navigate = useNavigate();
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			void navigate({
				to: "/main-menu",
			});
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		navigate,
	]);

	return (
		<LauncherScene
			compactHero
			dataUi="About"
			viewTransitionName={routeSceneViewTransitionName}
		>
			<section
				className="grid w-full max-w-xl gap-4 rounded-2xl border border-line bg-surface/80 p-6 text-center shadow-2xl backdrop-blur-xl"
				data-ui="AboutPanel"
				style={{
					viewTransitionName: launcherPanelViewTransitionName,
				}}
			>
				<h1 className="text-2xl font-semibold">About Arkini</h1>
				<p className="leading-7 text-muted">
					Arkini is a merge-economy game about building production chains, discovering
					recipes and shaping a living board-sized world.
				</p>
				<p className="text-sm text-subtle">
					Created by Marek Hanzal with ChatGPT / OpenAI.
				</p>
				<PrimaryButtonLink
					to="/main-menu"
					className="mx-auto"
				>
					Return to main menu
				</PrimaryButtonLink>
			</section>
		</LauncherScene>
	);
};
