import { useAtom, useAtomValue } from "@effect/atom-react";
import type { Effect } from "effect";
import { useCallback, useEffect, useState } from "react";

import { AppearanceAtom } from "~/bridge/appearance/AppearanceAtom";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import { openDiagnosticDirectoryFx } from "~/bridge/diagnostics/Diagnostics";
import {
	checkEditorMcpPortFx,
	readEditorMcpPortFx,
	writeEditorMcpPortFx,
} from "~/bridge/editor-mcp/EditorMcpPort";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { WindowMode } from "~/bridge/window/WindowMode";
import { WindowModeAtom } from "~/bridge/window/WindowModeAtom";
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
	const windowMode = useAtomValue(WindowModeAtom);
	const [commandState, runCommand] = useAtom(SettingsCommandAtom);
	const [editorMcpPort, setEditorMcpPort] = useState("");
	const [editorMcpPortStatus, setEditorMcpPortStatus] = useState<
		| {
				readonly kind: "loading" | "idle" | "checking" | "available" | "active";
		  }
		| {
				readonly kind: "error";
				readonly message: string;
		  }
	>({
		kind: "loading",
	});
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
	const checkEditorMcpPort = useCallback(() => {
		if (editorMcpPortStatus.kind === "checking") return;
		const port = Number(editorMcpPort.trim());
		if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
			setEditorMcpPortStatus({
				kind: "error",
				message: "Use a port from 1024 to 65535.",
			});
			return;
		}
		setEditorMcpPortStatus({
			kind: "checking",
		});
		void RendererRuntime.runPromise(checkEditorMcpPortFx(port))
			.then((availability) => {
				if (availability.type === "unavailable") {
					setEditorMcpPortStatus({
						kind: "error",
						message: availability.message,
					});
					return;
				}
				return RendererRuntime.runPromise(writeEditorMcpPortFx(port)).then(() => {
					setEditorMcpPortStatus({
						kind: availability.type === "active" ? "active" : "available",
					});
				});
			})
			.catch((error) => {
				setEditorMcpPortStatus({
					kind: "error",
					message: error instanceof Error ? error.message : String(error),
				});
			});
	}, [
		editorMcpPort,
		editorMcpPortStatus.kind,
	]);

	useEffect(() => {
		let active = true;
		void RendererRuntime.runPromise(readEditorMcpPortFx())
			.then((port) => {
				if (!active) return;
				setEditorMcpPort(String(port));
				setEditorMcpPortStatus({
					kind: "idle",
				});
			})
			.catch((error) => {
				if (!active) return;
				setEditorMcpPortStatus({
					kind: "error",
					message: error instanceof Error ? error.message : String(error),
				});
			});
		return () => {
			active = false;
		};
	}, []);

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
		editorMcpPort,
		editorMcpPortStatus,
		exitPending,
		diagnosticsStatus,
		status: commandState,
		theme: appearance.theme,
		windowMode,
		goBack,
		openDiagnostics,
		checkEditorMcpPort,
		setEditorMcpPort: (value: string) => {
			setEditorMcpPort(value);
			setEditorMcpPortStatus({
				kind: "idle",
			});
		},
		selectTheme: (theme: AppearanceTheme) => {
			runCommand({
				action: "theme",
				theme,
			});
		},
		selectWindowMode: (mode: WindowMode) => {
			runCommand({
				action: "window-mode",
				mode,
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
