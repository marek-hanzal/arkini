import type { Game } from "~/bridge/game/Game";
import { useGameCheats } from "~/bridge/cheat/useGameCheats";
import { useSetCheatEnabledMutation } from "~/bridge/cheat/useSetCheatEnabledMutation";
import { useSetInstantGameplayMutation } from "~/bridge/cheat/useSetInstantGameplayMutation";
import { Button } from "~/ui/button/Button";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Renders the small save-scoped cheat option surface for one exact Game. */
export const Cheats = ({ game, onBack }: { readonly game: Game; readonly onBack: () => void }) => {
	const cheats = useGameCheats(game);
	const setCheatEnabled = useSetCheatEnabledMutation(game);
	const setInstantGameplay = useSetInstantGameplayMutation(game);
	const blocked = setCheatEnabled.isPending || setInstantGameplay.isPending;

	return (
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
						className={`ak-list-row ak-list-row-interactive flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-line bg-surface/70 px-4 py-3 ${blocked ? "ak-list-row-pending cursor-progress" : ""}`}
						data-ui="CheatsEnabledForGame"
					>
						<span className="grid gap-1">
							<span className="text-sm font-semibold">
								Enable cheats for this game
							</span>
							<span className="text-sm leading-5 text-muted">
								Permanently marks this save as having used cheats once enabled.
							</span>
						</span>
						<input
							type="checkbox"
							checked={cheats.enabled}
							className="size-5 shrink-0 accent-accent"
							disabled={blocked}
							onChange={(event) =>
								setCheatEnabled.mutate(event.currentTarget.checked)
							}
						/>
					</label>

					<label
						className={`ak-list-row flex items-center justify-between gap-4 rounded-lg border border-line bg-surface/70 px-4 py-3 ${!cheats.enabled ? "opacity-60" : "ak-list-row-interactive cursor-pointer"} ${blocked ? "ak-list-row-pending cursor-progress" : ""}`}
						data-ui="CheatsInstantGameplay"
					>
						<span className="grid gap-1">
							<span className="text-sm font-semibold">Instant gameplay</span>
							<span className="text-sm leading-5 text-muted">
								Removes waiting time while preserving normal requirements,
								placement, charges and lifecycle rules.
							</span>
						</span>
						<input
							type="checkbox"
							checked={cheats.instantGameplay}
							className="size-5 shrink-0 accent-accent"
							disabled={blocked || !cheats.enabled}
							onChange={(event) =>
								setInstantGameplay.mutate(event.currentTarget.checked)
							}
						/>
					</label>
				</div>

				<div
					className="min-h-5 text-center text-sm"
					aria-live="polite"
					data-ui="CheatsStatus"
				>
					{setCheatEnabled.isPending ? (
						<p className="text-accent">Saving Cheat mode…</p>
					) : setCheatEnabled.isError ? (
						<p className="text-danger">
							Cheat mode update failed: {errorMessage(setCheatEnabled.error)}
						</p>
					) : setInstantGameplay.isPending ? (
						<p className="text-accent">Saving Instant gameplay…</p>
					) : setInstantGameplay.isError ? (
						<p className="text-danger">
							Instant gameplay update failed: {errorMessage(setInstantGameplay.error)}
						</p>
					) : setCheatEnabled.isSuccess ? (
						<p className="text-muted">Cheat mode saved.</p>
					) : setInstantGameplay.isSuccess ? (
						<p className="text-muted">Instant gameplay saved.</p>
					) : null}
				</div>

				<Button
					className="ak-list-row ak-list-row-interactive w-full shadow-none"
					disabled={blocked}
					onClick={onBack}
				>
					Back to game
				</Button>
			</section>
		</main>
	);
};
