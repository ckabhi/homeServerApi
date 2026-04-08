const MIN_CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_CHUNK_SIZE = 90 * 1024 * 1024; // 90 MB
const TARGET_CHUNK_COUNT = 50;

/**
 * Dynamically calculate chunk size clamped between 5MB and 90MB.
 * Aims to split the file into ~50 chunks, but respects min/max boundaries.
 */
export function calculateChunkSize(fileSize: number): {
  chunkSize: number;
  totalChunks: number;
} {
  let chunkSize = Math.ceil(fileSize / TARGET_CHUNK_COUNT);

  if (chunkSize < MIN_CHUNK_SIZE) {
    chunkSize = MIN_CHUNK_SIZE;
  } else if (chunkSize > MAX_CHUNK_SIZE) {
    chunkSize = MAX_CHUNK_SIZE;
  }

  const totalChunks = Math.ceil(fileSize / chunkSize);

  return { chunkSize, totalChunks };
}
