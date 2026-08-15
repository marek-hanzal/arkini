import { Effect } from "effect";

import type { EditorItemSimulation } from "~/editor/simulator/EditorItemSimulation";

export const EditorItemEstimatePlannerRevision = 1;

export interface EditorItemEstimatePersistenceSnapshot {
	readonly plannerRevision: number;
	readonly projectId: string;
	readonly revision: number;
}

export interface EditorItemEstimatePersistenceService {
	readonly pruneProjectFx: (
		snapshot: EditorItemEstimatePersistenceSnapshot,
	) => Effect.Effect<void>;
	readonly readSnapshotFx: (
		snapshot: EditorItemEstimatePersistenceSnapshot,
	) => Effect.Effect<ReadonlyArray<EditorItemSimulation>>;
	readonly writeEstimateFx: (
		snapshot: EditorItemEstimatePersistenceSnapshot,
		estimate: EditorItemSimulation,
	) => Effect.Effect<void>;
}

const databaseName = "arkini-editor-estimates";
const databaseVersion = 2;
const storeName = "estimates";

interface StoredEstimate {
	readonly estimate: EditorItemSimulation;
	readonly itemId: string;
	readonly plannerRevision: number;
	readonly projectId: string;
	readonly quantity: number;
	readonly revision: number;
}

const openDatabase = () =>
	new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(databaseName, databaseVersion);
		request.addEventListener("upgradeneeded", () => {
			const database = request.result;
			const store = database.objectStoreNames.contains(storeName)
				? request.transaction!.objectStore(storeName)
				: database.createObjectStore(storeName, {
						keyPath: [
							"projectId",
							"revision",
							"plannerRevision",
							"itemId",
							"quantity",
						],
					});
			if (!store.indexNames.contains("snapshot"))
				store.createIndex(
					"snapshot",
					[
						"projectId",
						"revision",
						"plannerRevision",
					],
					{
						unique: false,
					},
				);
			if (!store.indexNames.contains("project"))
				store.createIndex("project", "projectId", {
					unique: false,
				});
		});
		request.addEventListener("success", () => resolve(request.result), {
			once: true,
		});
		request.addEventListener(
			"error",
			() => reject(request.error ?? new Error("Could not open estimate cache database.")),
			{
				once: true,
			},
		);
	});

const waitForTransaction = (transaction: IDBTransaction) =>
	new Promise<void>((resolve, reject) => {
		transaction.addEventListener("complete", () => resolve(), {
			once: true,
		});
		transaction.addEventListener(
			"abort",
			() => reject(transaction.error ?? new Error("Estimate cache transaction aborted.")),
			{
				once: true,
			},
		);
		transaction.addEventListener(
			"error",
			() => reject(transaction.error ?? new Error("Estimate cache transaction failed.")),
			{
				once: true,
			},
		);
	});

const readSnapshot = async (
	snapshot: EditorItemEstimatePersistenceSnapshot,
): Promise<ReadonlyArray<EditorItemSimulation>> => {
	const database = await openDatabase();
	try {
		const transaction = database.transaction(storeName, "readonly");
		const index = transaction.objectStore(storeName).index("snapshot");
		const request = index.getAll([
			snapshot.projectId,
			snapshot.revision,
			snapshot.plannerRevision,
		]);
		const values = await new Promise<StoredEstimate[]>((resolve, reject) => {
			request.addEventListener("success", () => resolve(request.result as StoredEstimate[]), {
				once: true,
			});
			request.addEventListener(
				"error",
				() => reject(request.error ?? new Error("Could not read estimate cache.")),
				{
					once: true,
				},
			);
		});
		await waitForTransaction(transaction);
		return values.map(({ estimate }) => estimate);
	} finally {
		database.close();
	}
};

const pruneProject = async (snapshot: EditorItemEstimatePersistenceSnapshot) => {
	const database = await openDatabase();
	try {
		const transaction = database.transaction(storeName, "readwrite");
		const index = transaction.objectStore(storeName).index("project");
		const request = index.openCursor(IDBKeyRange.only(snapshot.projectId));
		await new Promise<void>((resolve, reject) => {
			request.addEventListener("success", () => {
				const cursor = request.result;
				if (cursor === null) {
					resolve();
					return;
				}
				const value = cursor.value as StoredEstimate;
				if (
					value.revision !== snapshot.revision ||
					value.plannerRevision !== snapshot.plannerRevision
				)
					cursor.delete();
				cursor.continue();
			});
			request.addEventListener(
				"error",
				() => reject(request.error ?? new Error("Could not prune estimate cache.")),
				{
					once: true,
				},
			);
		});
		await waitForTransaction(transaction);
	} finally {
		database.close();
	}
};

const writeEstimate = async (
	snapshot: EditorItemEstimatePersistenceSnapshot,
	estimate: EditorItemSimulation,
) => {
	const database = await openDatabase();
	try {
		const transaction = database.transaction(storeName, "readwrite");
		transaction.objectStore(storeName).put({
			estimate,
			itemId: estimate.itemId,
			plannerRevision: snapshot.plannerRevision,
			projectId: snapshot.projectId,
			quantity: estimate.quantity,
			revision: snapshot.revision,
		} satisfies StoredEstimate);
		await waitForTransaction(transaction);
	} finally {
		database.close();
	}
};

const available = () => typeof indexedDB !== "undefined";

/** Best-effort persistent cache for derived editor estimates under the stable renderer origin. */
export const EditorItemEstimatePersistence: EditorItemEstimatePersistenceService = {
	pruneProjectFx: (snapshot) =>
		available()
			? Effect.tryPromise(() => pruneProject(snapshot)).pipe(Effect.catch(() => Effect.void))
			: Effect.void,
	readSnapshotFx: (snapshot) =>
		available()
			? Effect.tryPromise(() => readSnapshot(snapshot)).pipe(
					Effect.catch(() => Effect.succeed([] as ReadonlyArray<EditorItemSimulation>)),
				)
			: Effect.succeed([]),
	writeEstimateFx: (snapshot, estimate) =>
		available()
			? Effect.tryPromise(() => writeEstimate(snapshot, estimate)).pipe(
					Effect.catch(() => Effect.void),
				)
			: Effect.void,
};
