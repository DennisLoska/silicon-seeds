// Helper to truncate long job IDs for display on mobile
export const truncateJobId = (id: string): string => {
  if (!id || id.length <= 8) return id;
  // Show first 8 chars only
  return id.slice(0, 8);
};

export function getAssetPath(subfolder: string, filename: string): string {
  const cleanSubfolder = subfolder.endsWith("/")
    ? subfolder.slice(0, -1)
    : subfolder;

  if (!cleanSubfolder || cleanSubfolder.trim() === "") {
    return `/assets/${filename}`;
  }

  return `/assets/${cleanSubfolder}/${filename}`;
}
