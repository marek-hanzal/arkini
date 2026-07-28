import { useAtom, useAtomValue } from "@effect/atom-react";
import type { Effect } from "effect";
import { useCallback, useEffect, useState } from "react";

import { AppearanceAtom } from "~/bridge/appearance/AppearanceAtom";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import { openDiagnosticDirectoryFx } from "~/bridge/diagnostics/Diagnostics";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { useCheatAvailability } from "~/ui/cheat-availability/useCheatAvailability";
import { SettingsCommandAtom } from "~/ui/settings/SettingsCommandAtom";

/** Owns application settings commands and the one Escape lifecycle for the settings surface. */
export const useSettingsModel = ({
	onBackFx,
}: {
	readonly onBackFx: Effect.Effect<void, unknown>;
}) => {
	const appearance = useAtomValue(AppearanceAtom);
	const cheatAvailability = useCheatAvailability();
	const [commandState, runCommand] = useAtom(SettingsCommandAtom);
	const [diagnosticsStatus, setDiagnosticsStatus] = useState<
		| {
				readonly kind: "idle";
		  }
		| {
				readonly kind: "pending";
		  }
		| {
				readonly kind: "error";
				readonly error: unknown;
		  }
	>({
		kind: "idle",
	});
	const blocked = commandState.kind === "pending";
	const exitPending = commandState.kind === "pending" && commandState.action === "exit";
	const goBack = useCallback(() => {
		runCommand({
			action: "exit",
			runFx: onBackFx,
		});
	}, [
		onBackFx,
		runCommand,
	]);
	const openDiagnostics = useCallback(() => {
		if (diagnosticsStatus.kind === "pending") return;
		setDiagnosticsStatus({
			kind: "pending",
		});
		void RendererRuntime.runPromise(openDiagnosticDirectoryFx())
			.then(() => {
				setDiagnosticsStatus({
					kind: "idle",
				});
			})
			.catch((error) => {
				setDiagnosticsStatus({
					kind: "error",
					error,
				});
			});
	}, [
		diagnosticsStatus.kind,
	]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || blocked) return;
			event.preventDefault();
			goBack();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		blocked,
		goBack,
	]);

	return {
		blocked,
		cheatToolsAvailable: cheatAvailability.available,
		exitPending,
		diagnosticsStatus,
		status: commandState,
		theme: appearance.theme,
		goBack,
		openDiagnostics,
		selectTheme: (theme: AppearanceTheme) => {
			runCommand({
				action: "theme",
				theme,
			});
		},
		setCheatToolsAvailable: (available: boolean) => {
			runCommand({
				action: "cheat-tools",
				available,
			});
		},
	};
};
