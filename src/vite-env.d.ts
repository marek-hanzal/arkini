/// <reference types="vite/client" />

interface FileSystemDirectoryHandle {
	remove(options: { recursive: boolean }): Promise<void>;
}
