export type FolderSummary = {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
  docCount: number;
};

export type FolderDocument = {
  id: string;
  fileName: string;
  fileMime: string;
  fileSize: number;
  date: string;
  vendor: string;
  amount: string;
  createdAt: string;
};

export type FoldersListCache = {
  year: number;
  month: number | null;
  syncedAt: string;
  folders: FolderSummary[];
};

export type FolderDetailCache = {
  folderId: string;
  year: number;
  month: number | null;
  syncedAt: string;
  folder: { id: string; name: string; icon: string };
  documents: FolderDocument[];
};

const LIST_PREFIX = "receipts_folders_v2";
const DETAIL_PREFIX = "receipts_folder_detail_v2";

function listKey(userId: string, year: number, month: number | null) {
  return `${LIST_PREFIX}_${userId}_${year}_${month ?? 0}`;
}

function detailKey(userId: string, folderId: string, year: number, month: number | null) {
  return `${DETAIL_PREFIX}_${userId}_${folderId}_${year}_${month ?? 0}`;
}

export function readFoldersListCache(
  userId: string,
  year: number,
  month: number | null = null,
): FoldersListCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(listKey(userId, year, month));
    if (!raw) return null;
    return JSON.parse(raw) as FoldersListCache;
  } catch {
    return null;
  }
}

export function writeFoldersListCache(userId: string, data: FoldersListCache) {
  if (typeof window === "undefined") return;
  localStorage.setItem(listKey(userId, data.year, data.month), JSON.stringify(data));
}

export function readFolderDetailCache(
  userId: string,
  folderId: string,
  year: number,
  month: number | null = null,
): FolderDetailCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(detailKey(userId, folderId, year, month));
    if (!raw) return null;
    return JSON.parse(raw) as FolderDetailCache;
  } catch {
    return null;
  }
}

export function writeFolderDetailCache(userId: string, data: FolderDetailCache) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    detailKey(userId, data.folderId, data.year, data.month),
    JSON.stringify(data),
  );
}

export function yearRangeFrom(minYear: number): number[] {
  const current = new Date().getFullYear();
  const end = Math.max(current, minYear);
  const years: number[] = [];
  for (let y = end; y >= minYear; y--) years.push(y);
  return years;
}
