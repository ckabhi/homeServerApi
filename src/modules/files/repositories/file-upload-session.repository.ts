import { FileUploadSession, Prisma } from '@prisma/client';

export type CreateSessionInput = Prisma.FileUploadSessionCreateInput;
export type UpdateSessionInput = Prisma.FileUploadSessionUpdateInput;

/**
 * Contract for file upload session persistence operations.
 */
export interface IFileUploadSessionRepository {
  create(data: CreateSessionInput): Promise<FileUploadSession>;
  findById(id: string): Promise<FileUploadSession | null>;
  findByUserId(userId: string): Promise<FileUploadSession[]>;
  update(id: string, data: UpdateSessionInput): Promise<FileUploadSession>;
  delete(id: string): Promise<void>;
  deleteExpiredSessions(): Promise<number>;
}
