import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { PrimaryButtonLink } from "~/ui/button/Button";

/** Renders concise project and authorship credits for the normalized About page. */
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
		<div
			className="grid gap-4 text-center"
			data-ui="About"
		>
			<h1
				id="about-title"
				className="text-2xl font-semibold"
			>
				About Arkini
			</h1>
			<p className="leading-7 text-muted">
				Arkini is a merge-economy game about building production chains, discovering recipes
				and shaping a living board-sized world.
			</p>
			<p className="text-sm text-subtle">Created by Marek Hanzal with ChatGPT / OpenAI.</p>
			<PrimaryButtonLink
				to="/main-menu"
				className="mx-auto"
			>
				Return to main menu
			</PrimaryButtonLink>
		</div>
	);
};
