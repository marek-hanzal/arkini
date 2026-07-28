import { useAtom, useAtomValue } from "@effect/atom-react";
import { Cause } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";
import { ArkiniArkpack } from "~/bridge/arkpack/ArkiniArkpack";
import { useArkpacks } from "~/bridge/arkpack/useArkpacks";
import { Button, ButtonLink, PrimaryButton, PrimaryButtonLink } from "~/ui/button/Button";
import { LauncherStartupAtom } from "~/ui/launcher/LauncherStartupAtom";
import { MainMenuExitCommandAtom } from "~/ui/launcher/MainMenuExitCommandAtom";

/** Renders the semantic out-of-game launcher actions over authoritative startup state. */
export const MainMenu = () => {
	const { state: catalogState } = useArkpacks();
	const startup = useAtomValue(LauncherStartupAtom);
	const [exitState, requestExit] = useAtom(MainMenuExitCommandAtom);
	const exitPending = exitState.kind === "pending";
	const builtInAvailable =
		AsyncResult.isSuccess(startup) &&
		!startup.waiting &&
		startup.value.builtInPackageId === ArkiniArkpack.packageId &&
		catalogState.type === "ready" &&
		catalogState.arkpacks.some(
			(arkpack) =>
				arkpack.source === "built-in" &&
				arkpack.trust.type === "official" &&
				arkpack.gameId === "arkini" &&
				arkpack.packageId === ArkiniArkpack.packageId,
		);

	return (
		<nav
			className="grid w-full gap-4"
			aria-label="Main menu"
			data-ui="MainMenu"
		>
			{builtInAvailable ? (
				<PrimaryButtonLink
					to="/action/load-game/$packageId"
					preload={false}
					params={{
						packageId: ArkiniArkpack.packageId,
					}}
					className="rounded-xl"
				>
					Play
				</PrimaryButtonLink>
			) : (
				<PrimaryButton
					className="rounded-xl"
					cursorIntent={
						catalogState.type === "failed" ||
						(AsyncResult.isFailure(startup) && !startup.waiting)
							? "not-allowed"
							: "progress"
					}
					disabled
				>
					{catalogState.type === "failed" ||
					(AsyncResult.isFailure(startup) && !startup.waiting)
						? "Play unavailable"
						: "Preparing Play…"}
				</PrimaryButton>
			)}
			<ButtonLink
				to="/arkpacks"
				className="rounded-xl"
			>
				Arkpacks
			</ButtonLink>
			<ButtonLink
				to="/settings"
				className="rounded-xl"
			>
				Settings
			</ButtonLink>
			<ButtonLink
				to="/about"
				className="rounded-xl"
			>
				About
			</ButtonLink>
			<Button
				className="rounded-xl"
				cursorIntent={exitPending ? "progress" : undefined}
				disabled={exitPending}
				onClick={() => requestExit(undefined)}
			>
				{exitPending ? "Exiting…" : "Exit"}
			</Button>
			<p
				className="pt-1 text-center text-xs text-subtle"
				data-ui="ArkiniAppVersion"
			>
				v{ArkiniAppVersion}
			</p>
			{catalogState.type === "failed" ? (
				<p className="text-center text-sm text-danger">
					Catalog failed: {String(catalogState.error)}
				</p>
			) : AsyncResult.isFailure(startup) && !startup.waiting ? (
				<p className="text-center text-sm text-danger">
					Startup failed: {String(Cause.squash(startup.cause))}
				</p>
			) : exitState.kind === "error" ? (
				<p className="text-center text-sm text-danger">
					Exit failed: {String(exitState.error)}
				</p>
			) : exitState.kind === "requested" ? (
				<p className="text-center text-sm text-muted">Exit requested.</p>
			) : null}
		</nav>
	);
};
