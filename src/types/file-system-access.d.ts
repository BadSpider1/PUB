// Parts of the File System Access API (WICG) that are not yet in TypeScript's lib.dom.
// https://wicg.github.io/file-system-access/

type FileSystemPermissionMode = 'read' | 'readwrite'

interface FileSystemHandlePermissionDescriptor {
  mode?: FileSystemPermissionMode
}

interface FileSystemHandle {
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
}

type WellKnownDirectory = 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'

interface DirectoryPickerOptions {
  id?: string
  mode?: FileSystemPermissionMode
  startIn?: WellKnownDirectory | FileSystemHandle
}

interface Window {
  showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>
}
