import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import type { EditorMcpOverviewSchema } from "~/authoring-mcp/schema/EditorMcpOverviewSchema";

import { PrimaryButton } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";
import { EditorValueField } from "~/editor-control/ui/EditorValueField";
import { EditorMcpCopyableUrl } from "./EditorMcpCopyableUrl";
import { EditorMcpStatus } from "./EditorMcpStatus";

const editorMcpInputClassName =
	"w-full rounded-lg border border-control-border bg-[var(--ak-editor-background)] px-3 py-2 text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60";

interface EditorMcpSettingsProps {
	readonly authtoken: string;
	readonly ngrokDomain: string;
	readonly onSaveNgrokFn: () => void;
	readonly onSavePortFn: () => void;
	readonly onSetAuthtokenFn: (value: string) => void;
	readonly onSetNgrokDomainFn: (value: string) => void;
	readonly onSetPortFn: (value: string) => void;
	readonly overview: EditorMcpOverviewSchema.Type;
	readonly pending: boolean;
	readonly port: string;
}

export const EditorMcpSettings = ({
	authtoken,
	ngrokDomain,
	onSaveNgrokFn,
	onSavePortFn,
	onSetAuthtokenFn,
	onSetNgrokDomainFn,
	onSetPortFn,
	overview,
	pending,
	port,
}: EditorMcpSettingsProps) => {
	const configuredDomain = overview.ngrokDomain;
	const remoteRunning = overview.remote.type === "ready" || overview.remote.type === "starting";
	const portDisabled =
		pending || overview.local.type === "ready" || overview.remote.type === "ready";
	const ngrokDisabled = pending || remoteRunning;
	const localUrl = `http://127.0.0.1:${port}/editor/mcp`;
	return (
		<div className="grid gap-4">
			<EditorRootCard
				className="gap-3"
				dataUi="EditorMcpLocalSettingsCard"
			>
				<div>
					<h2 className="font-semibold">Local server</h2>
					<p className="mt-1 text-sm text-muted">
						The open local endpoint is intended for trusted tools running on this
						computer.
					</p>
				</div>
				<EditorValueField
					as="div"
					label="Port"
					required
				>
					<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
						<input
							type="number"
							min={1_024}
							max={65_535}
							value={port}
							className={editorMcpInputClassName}
							disabled={portDisabled}
							onChange={(event) => onSetPortFn(event.currentTarget.value)}
						/>
						<LinkButton
							disabled={pending}
							onClick={onSavePortFn}
						>
							Save
						</LinkButton>
					</div>
				</EditorValueField>
				<EditorMcpCopyableUrl
					label="Local endpoint"
					url={localUrl}
				/>
			</EditorRootCard>
			<EditorRootCard
				className="gap-3"
				dataUi="EditorMcpRemoteSettingsCard"
			>
				<div>
					<h2 className="font-semibold">ngrok</h2>
					<p className="mt-1 text-sm text-muted">
						The ngrok authtoken is stored unencrypted on this device. Use a dedicated,
						revocable authtoken for Arkini. On supported ngrok plans, restrict it to
						this Development Domain.
					</p>
				</div>
				<EditorValueField
					label="Development domain"
					required
				>
					<input
						value={ngrokDomain}
						className={editorMcpInputClassName}
						disabled={ngrokDisabled}
						placeholder="your-assigned-name.ngrok-free.app"
						onChange={(event) => onSetNgrokDomainFn(event.currentTarget.value)}
					/>
				</EditorValueField>
				<EditorValueField
					label="Authtoken"
					required
				>
					<input
						type="password"
						value={authtoken}
						className={editorMcpInputClassName}
						disabled={ngrokDisabled}
						placeholder={
							configuredDomain === undefined
								? "Paste ngrok authtoken"
								: "Configured — paste to replace"
						}
						onChange={(event) => onSetAuthtokenFn(event.currentTarget.value)}
					/>
				</EditorValueField>
				<PrimaryButton
					className="justify-self-start"
					disabled={ngrokDisabled}
					onClick={onSaveNgrokFn}
				>
					Save ngrok configuration
				</PrimaryButton>
				<EditorMcpStatus
					message={
						configuredDomain === undefined
							? "ngrok is not configured."
							: `Configured for ${configuredDomain}.`
					}
					tone={configuredDomain === undefined ? "muted" : "success"}
				/>
			</EditorRootCard>
		</div>
	);
};
