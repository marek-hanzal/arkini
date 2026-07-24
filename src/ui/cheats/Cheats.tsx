import { match } from "ts-pattern";

import { Button } from "~/ui/button/Button";
import type { useCheatsModel } from "~/ui/cheats/useCheatsModel";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Renders the small save-scoped cheat option surface from one authoritative model. */
export const Cheats = ({
	model,
	onBack,
}: {
	readonly model: useCheatsModel.Model;
	readonly onBack: () => void;
}) => (
	<main
		className="relative grid size-full min-h-0 min-w-0 place-items-center overflow-hidden bg-canvas p-[var(--ak-viewport-padding)] text-foreground"
		data-ui="CheatsPage"
	>
		<section
			className="grid w-[34rem] max-w-full gap-6 rounded-2xl border border-line-strong bg-surface-raised p-[var(--ak-panel-padding)] shadow-2xl"
			aria-labelledby="cheats-title"
			data-ui="Cheats"
		>
			<header className="grid gap-2">
				<h1
					id="cheats-title"
					className="text-xl font-semibold"
				>
					Cheats
				</h1>
				<p className="text-sm leading-6 text-muted">
					These options belong only to this saved game.
				</p>
			</header>

			<div className="ak-list grid gap-2">
				<label
					className={`ak-list-row ak-list-row-interactive flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-line px-4 py-3 ${model.blocked ? "ak-list-row-pending cursor-progress" : ""}`}
					data-ui="CheatsEnabledForGame"
				>
					<span className="grid gap-1">
						<span className="text-sm font-semibold">Enable cheats for this game</span>
						<span className="text-sm leading-5 text-muted">
							Permanently marks this save as having used cheats once enabled.
						</span>
					</span>
					<input
						type="checkbox"
						checked={model.enabled}
						className="size-5 shrink-0 accent-accent"
						disabled={model.blocked}
						onChange={(event) => model.setEnabled(event.currentTarget.checked)}
					/>
				</label>

				<label
					className={`ak-list-row flex items-center justify-between gap-4 rounded-lg border border-line px-4 py-3 ${!model.enabled ? "opacity-60" : "ak-list-row-interactive cursor-pointer"} ${model.blocked ? "ak-list-row-pending cursor-progress" : ""}`}
					data-ui="CheatsInstantGameplay"
				>
					<span className="grid gap-1">
						<span className="text-sm font-semibold">Instant gameplay</span>
						<span className="text-sm leading-5 text-muted">
							Removes waiting time while preserving normal requirements, placement,
							charges and lifecycle rules.
						</span>
					</span>
					<input
						type="checkbox"
						checked={model.instantGameplay}
						className="size-5 shrink-0 accent-accent"
						disabled={model.blocked || !model.enabled}
						onChange={(event) => model.setInstantGameplay(event.currentTarget.checked)}
					/>
				</label>
			</div>

			<div
				className="min-h-5 text-center text-sm"
				aria-live="polite"
				data-ui="CheatsStatus"
			>
				{match(model.status)
					.with(
						{
							kind: "pending",
						},
						({ label }) => <p className="text-accent">Saving {label}…</p>,
					)
					.with(
						{
							kind: "error",
						},
						({ error, label }) => (
							<p className="text-danger">
								{label} update failed: {errorMessage(error)}
							</p>
						),
					)
					.with(
						{
							kind: "success",
						},
						({ label }) => <p className="text-muted">{label} saved.</p>,
					)
					.with(
						{
							kind: "idle",
						},
						() => null,
					)
					.exhaustive()}
			</div>

			<Button
				className="w-full shadow-none"
				disabled={model.blocked}
				onClick={onBack}
			>
				Back to game
			</Button>
		</section>
	</main>
);
