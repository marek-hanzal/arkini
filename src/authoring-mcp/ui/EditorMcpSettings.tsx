import type { EditorMcpOverviewSchema } from "~electron/contract/editor/EditorMcpOverviewSchema";

import { Button, PrimaryButton } from "~/ui/ui/Button";
import { EditorMcpCopyableUrl } from "./EditorMcpCopy";
import { EditorMcpStatus } from "./EditorMcpStatus";

const editorMcpInputClassName =
	"w-full rounded-lg border border-line bg-surface px-3 py-2 text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60";

interface EditorMcpSettingsProps {
	readonly authtoken: string;
	readonly copied?: string;
	readonly ngrokDomain: string;
	readonly onCopyFn: (key: string, value: string) => Promise<void>;
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
	copied,
	ngrokDomain,
	onCopyFn,
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
			<div className="ak-list-row grid gap-3 rounded-xl border border-line p-5">
				<div>
					<h2 className="font-semibold">Local server</h2>
					<p className="mt-1 text-sm text-muted">
						The open local endpoint is intended for trusted tools running on this
						computer.
					</p>
				</div>
				<label className="grid gap-2">
					<span className="text-sm font-semibold">Port</span>
					<input
						type="number"
						min={1_024}
						max={65_535}
						value={port}
						className={editorMcpInputClassName}
						disabled={portDisabled}
						onChange={(event) => onSetPortFn(event.currentTarget.value)}
					/>
				</label>
				<Button
					className="justify-self-start"
					disabled={pending}
					onClick={onSavePortFn}
				>
					Save port
				</Button>
				<EditorMcpCopyableUrl
					copied={copied === "local-url"}
					label="Local endpoint"
					onCopyFn={() => void onCopyFn("local-url", localUrl)}
					url={localUrl}
				/>
			</div>
			<div className="ak-list-row grid gap-3 rounded-xl border border-line p-5">
				<div>
					<h2 className="font-semibold">ngrok</h2>
					<p className="mt-1 text-sm text-muted">
						The ngrok authtoken is stored unencrypted on this device. Use a dedicated,
						revocable authtoken for Arkini. On supported ngrok plans, restrict it to
						this Development Domain.
					</p>
				</div>
				<label className="grid gap-2">
					<span className="text-sm font-semibold">Development domain</span>
					<input
						value={ngrokDomain}
						className={editorMcpInputClassName}
						disabled={ngrokDisabled}
						placeholder="your-assigned-name.ngrok-free.app"
						onChange={(event) => onSetNgrokDomainFn(event.currentTarget.value)}
					/>
				</label>
				<label className="grid gap-2">
					<span className="text-sm font-semibold">Authtoken</span>
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
				</label>
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
			</div>
		</div>
	);
};
