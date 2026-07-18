import { useRef } from "react";
import { MainMenuPage } from "~/page/launcher/MainMenuPage";
import { StartupSplash } from "~/ui/launcher/StartupSplash";

/** Mounts the hidden main-menu destination beneath the one-session outgoing splash scene. */
export const StartupPage = () => {
	const mainMenuRef = useRef<HTMLDivElement>(null);

	return (
		<div className="relative size-full min-h-0 min-w-0 overflow-hidden bg-black">
			<div
				ref={mainMenuRef}
				className="absolute inset-0 opacity-0"
				aria-hidden="true"
				inert
			>
				<MainMenuPage />
			</div>
			<StartupSplash mainMenuRef={mainMenuRef} />
		</div>
	);
};
