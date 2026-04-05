// Helper to truncate long job IDs for display on mobile
export const truncateJobId = (id: string): string => {
  if (!id || id.length <= 8) return id;
  // Show first 8 chars only
  return id.slice(0, 8);
};
