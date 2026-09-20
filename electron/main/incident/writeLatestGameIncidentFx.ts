import { Effect } from "effect";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { GameIncidentWrite } from "~electron/contract/incident/GameIncidentWrite";
import { GameIncidentFiles } from "~shared/GameIncidentMetadata";
import { readSerapackArtifactNameFn } from "~/serapack-artifact/fn/readSerapackArtifactNameFn";
import { readSerapackFileLayoutFx } from "~/serapack-artifact/fx/readSerapackFileLayoutFx";

export namespace writeLatestGameIncidentFx {
	export interface Props {
		readonly bundledSerapacksRoot: string;
		readonly incidentsRoot: string;
		readonly incident: GameIncidentWrite;
		readonly userSerapacksRoot: string;
	}
}

/** Overwrites the one disposable failed-session environment exposed to local tooling. */
export const writeLatestGameIncidentFx = Effect.fn("writeLatestGameIncidentFx")(
	({
		bundledSerapacksRoot,
		incidentsRoot,
		incident,
		userSerapacksRoot,
	}: writeLatestGameIncidentFx.Props) =>
		Effect.gen(function* () {
			const serapackPath = join(
				incident.serapack.source === "bundled" ? bundledSerapacksRoot : userSerapacksRoot,
				readSerapackArtifactNameFn(incident.serapack.packageId),
			);
			const layout = yield* readSerapackFileLayoutFx(serapackPath);
			if (layout.contentHash !== incident.serapack.contentHash)
				return yield* Effect.fail(
					new Error(
						"The installed Serapack changed before its incident could be archived.",
					),
				);
			yield* Effect.tryPromise({
				try: async () => {
					const directory = join(incidentsRoot, GameIncidentFiles.directory);
					await mkdir(directory, {
						recursive: true,
					});
					await rm(join(directory, "diagnostics.jsonl"), {
						force: true,
					});
					await copyFile(serapackPath, join(directory, GameIncidentFiles.serapack));
					await writeFile(join(directory, GameIncidentFiles.save), incident.saveBytes);
					await writeFile(
						join(directory, GameIncidentFiles.incident),
						incident.text.incident,
						"utf8",
					);
					await writeFile(
						join(directory, GameIncidentFiles.failure),
						incident.text.failure,
						"utf8",
					);
					await writeFile(
						join(directory, GameIncidentFiles.history),
						incident.text.history,
						"utf8",
					);
					await writeFile(
						join(directory, GameIncidentFiles.runtimeState),
						incident.text.runtimeState,
						"utf8",
					);
				},
				catch: (cause) => cause,
			});
		}),
);
