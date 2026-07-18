import { MainMenu } from "~/ui/launcher/MainMenu";
import { StartupSplash } from "~/ui/launcher/StartupSplash";

/** Mounts the main-menu destination beneath the one-session outgoing splash scene. */
export const StartupPage = () => (
	<div className="relative size-full min-h-0 min-w-0 overflow-hidden">
		<div
			className="absolute inset-0"
			aria-hidden="true"
			inert
		>
			<MainMenu />
		</div>
		<StartupSplash />
	</div>
);
