import type { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";

import {
	EditorProjectRepositoryError,
	type EditorProjectRepositoryOperation,
} from "~/editor/EditorProjectRepositoryError";
import { EditorNoteContentMaxLength } from "~/editor/note/EditorNoteSchema";

const schemaVersion = 5;
const createBoardScenariosSql = `
	CREATE TABLE board_scenarios (
		project_id TEXT NOT NULL,
		name TEXT NOT NULL,
		project_revision INTEGER NOT NULL CHECK (project_revision >= 0),
		arkpack_version TEXT NOT NULL,
		save_bytes BLOB NOT NULL CHECK (length(save_bytes) > 0),
		created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0),
		updated_at_ms INTEGER NOT NULL CHECK (updated_at_ms >= created_at_ms),
		PRIMARY KEY (project_id, name),
		FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
	) STRICT;
	CREATE INDEX board_scenarios_recent
		ON board_scenarios(project_id, updated_at_ms DESC, name ASC);
`;

const createProjectVersionsSql = `
	CREATE TABLE IF NOT EXISTS project_version_blobs (
		project_id TEXT NOT NULL,
		content_hash TEXT NOT NULL,
		bytes BLOB NOT NULL,
		PRIMARY KEY (project_id, content_hash),
		FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
	) STRICT;
	CREATE TABLE IF NOT EXISTS project_versions (
		project_id TEXT NOT NULL,
		version_id TEXT NOT NULL,
		parent_version_id TEXT,
		subject TEXT NOT NULL CHECK (length(subject) > 0),
		body TEXT,
		tag TEXT,
		arkini TEXT NOT NULL,
		arkpack_version TEXT NOT NULL,
		source_revision INTEGER NOT NULL CHECK (source_revision >= 0),
		snapshot_format_version INTEGER NOT NULL CHECK (snapshot_format_version > 0),
		config_json TEXT NOT NULL,
		content_fingerprint TEXT NOT NULL,
		created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0),
		PRIMARY KEY (project_id, version_id),
		FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
		FOREIGN KEY (project_id, parent_version_id)
			REFERENCES project_versions(project_id, version_id)
	) STRICT;
	CREATE INDEX IF NOT EXISTS project_versions_recent
		ON project_versions(project_id, created_at_ms DESC, version_id DESC);
	CREATE TABLE IF NOT EXISTS project_version_resources (
		project_id TEXT NOT NULL,
		version_id TEXT NOT NULL,
		resource_id TEXT NOT NULL,
		mime TEXT NOT NULL,
		blob_hash TEXT NOT NULL,
		PRIMARY KEY (project_id, version_id, resource_id),
		FOREIGN KEY (project_id, version_id)
			REFERENCES project_versions(project_id, version_id) ON DELETE CASCADE,
		FOREIGN KEY (project_id, blob_hash)
			REFERENCES project_version_blobs(project_id, content_hash)
	) STRICT;
	CREATE TABLE IF NOT EXISTS project_version_scenarios (
		project_id TEXT NOT NULL,
		version_id TEXT NOT NULL,
		name TEXT NOT NULL,
		project_revision INTEGER NOT NULL CHECK (project_revision >= 0),
		arkpack_version TEXT NOT NULL,
		blob_hash TEXT NOT NULL,
		created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0),
		updated_at_ms INTEGER NOT NULL CHECK (updated_at_ms >= created_at_ms),
		PRIMARY KEY (project_id, version_id, name),
		FOREIGN KEY (project_id, version_id)
			REFERENCES project_versions(project_id, version_id) ON DELETE CASCADE,
		FOREIGN KEY (project_id, blob_hash)
			REFERENCES project_version_blobs(project_id, content_hash)
	) STRICT;
	CREATE TABLE IF NOT EXISTS project_version_bases (
		project_id TEXT PRIMARY KEY NOT NULL,
		version_id TEXT NOT NULL,
		FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
		FOREIGN KEY (project_id, version_id)
			REFERENCES project_versions(project_id, version_id)
	) STRICT;
`;

const createProjectNotesSql = `
	CREATE TABLE IF NOT EXISTS project_notes (
		note_id TEXT NOT NULL,
		project_id TEXT NOT NULL,
		content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND ${EditorNoteContentMaxLength}),
		created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0),
		updated_at_ms INTEGER NOT NULL CHECK (updated_at_ms >= created_at_ms),
		PRIMARY KEY (project_id, note_id),
		FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
	) STRICT;
	CREATE INDEX IF NOT EXISTS project_notes_recent
		ON project_notes(project_id, updated_at_ms DESC, note_id DESC);
`;

const createRepositoryError = (
	operation: EditorProjectRepositoryOperation,
	message: string,
	cause?: unknown,
) =>
	cause instanceof EditorProjectRepositoryError
		? cause
		: new EditorProjectRepositoryError({
				operation,
				message,
				cause,
			});

const runTransaction = <Value>(database: DatabaseSync, run: () => Value): Value => {
	database.exec("BEGIN IMMEDIATE");
	try {
		const value = run();
		database.exec("COMMIT");
		return value;
	} catch (cause) {
		try {
			database.exec("ROLLBACK");
		} catch {
			// Preserve the migration failure that caused the rollback.
		}
		throw cause;
	}
};

/** Initializes or upgrades the one canonical editor-project SQLite schema. */
export const initializeSqliteEditorProjectSchemaFx = Effect.fn(
	"initializeSqliteEditorProjectSchemaFx",
)((database: DatabaseSync) =>
	Effect.try({
		try: () => {
			database.exec("PRAGMA foreign_keys = ON");
			database.exec("PRAGMA journal_mode = WAL");
			const version = database.prepare("PRAGMA user_version").get()?.user_version;
			if (version === schemaVersion) return;
			if (version !== 0 && version !== 1 && version !== 2 && version !== 3 && version !== 4)
				throw new Error(`Unsupported editor database schema version ${String(version)}.`);

			runTransaction(database, () => {
				if (version === 0) {
					database.exec(`
						CREATE TABLE projects (
							project_id TEXT PRIMARY KEY NOT NULL,
							config_json TEXT NOT NULL,
							arkpack_version TEXT NOT NULL,
							revision INTEGER NOT NULL CHECK (revision >= 0),
							created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0),
							updated_at_ms INTEGER NOT NULL CHECK (updated_at_ms >= created_at_ms)
						) STRICT;
						CREATE INDEX projects_recent
							ON projects(updated_at_ms DESC, project_id ASC);
						CREATE TABLE resources (
							project_id TEXT NOT NULL,
							id TEXT NOT NULL,
							mime TEXT NOT NULL,
							bytes BLOB NOT NULL,
							PRIMARY KEY (project_id, id),
							FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
						) STRICT;
						CREATE INDEX resources_by_project ON resources(project_id, id);
					`);
				} else if (version === 1) {
					database.exec(
						"ALTER TABLE projects ADD COLUMN arkpack_version TEXT NOT NULL DEFAULT '1.0'",
					);
					const select = database.prepare("SELECT project_id, config_json FROM projects");
					const update = database.prepare(
						"UPDATE projects SET config_json = ?, arkpack_version = '1.0' WHERE project_id = ?",
					);
					for (const row of select.all()) {
						if (
							typeof row.project_id !== "string" ||
							typeof row.config_json !== "string"
						)
							throw new Error(
								"SQLite contains an invalid legacy editor project row.",
							);
						const config = JSON.parse(row.config_json) as Record<string, unknown>;
						delete config.version;
						update.run(JSON.stringify(config), row.project_id);
					}
				}
				if (version !== 3 && version !== 4) database.exec(createBoardScenariosSql);
				database.exec(createProjectVersionsSql);
				database.exec(createProjectNotesSql);
				database.exec(`PRAGMA user_version = ${schemaVersion}`);
			});
		},
		catch: (cause) =>
			createRepositoryError(
				"list-projects",
				"The editor project database could not be initialized.",
				cause,
			),
	}),
);
