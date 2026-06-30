/// <reference types="vite/client" />

declare global {
	interface FileSystemDirectoryHandle {
		remove(options: { recursive: boolean }): Promise<void>;
	}
}

export {};
