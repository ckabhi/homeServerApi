import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { MinIOConnectionError } from './exceptions/file-errors';

@Injectable()
export class MinioService implements OnModuleInit {
  private minioClient!: Minio.Client;
  private readonly logger = new Logger(MinioService.name);
  private readonly defaultBucket = 'app-bucket-xtvnlqt';

  constructor(private readonly configService: ConfigService) {}

  private getPublicUrl = (url: string): string => {
    const endpoint = this.configService.get<string>(
      'MINIO_ENDPOINT',
      'localhost',
    );
    const port = this.configService.get<string>('MINIO_PORT', '9000');
    const publicEndpoint = this.configService.get<string>(
      'MINIO_SIGNED_URL_ENDPOINT',
      'localhost:9000',
    );
    return url.replace(`http://${endpoint}:${port}`, publicEndpoint);
  };

  async onModuleInit() {
    try {
      this.minioClient = new Minio.Client({
        endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
        port: parseInt(
          this.configService.get<string>('MINIO_PORT', '9000'),
          10,
        ),
        useSSL:
          this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true',
        accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', 'admin'),
        secretKey: this.configService.get<string>(
          'MINIO_SECRET_KEY',
          'password',
        ),
      });

      const exists = await this.minioClient.bucketExists(this.defaultBucket);
      if (!exists) {
        await this.minioClient.makeBucket(this.defaultBucket, 'us-east-1');
      }
      this.logger.log('MinIO client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize MinIO client', error);
      throw new MinIOConnectionError('Could not connect to storage service');
    }
  }

  getBucketName(): string {
    return this.defaultBucket;
  }

  async generatePresignedUrl(
    method: 'GET' | 'PUT',
    objectKey: string,
    expirySeconds: number,
  ): Promise<string> {
    try {
      let url: string;
      if (method === 'GET') {
        url = await this.minioClient.presignedGetObject(
          this.defaultBucket,
          objectKey,
          expirySeconds,
        );

        return this.getPublicUrl(url);
      } else {
        url = await this.minioClient.presignedPutObject(
          this.defaultBucket,
          objectKey,
          expirySeconds,
        );

        return this.getPublicUrl(url);
      }
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned URL for ${objectKey}`,
        error,
      );
      throw new MinIOConnectionError('Failed to generate presigned URL');
    }
  }

  async generatePresignedDownloadUrl(
    objectKey: string,
    displayName: string,
    expirySeconds: number = 3600,
  ): Promise<string> {
    try {
      const requestParams = {
        'response-content-disposition': `attachment; filename="${this.escapeFileName(displayName)}"`,
        'response-content-type': 'application/octet-stream',
      };

      const url: string = await this.minioClient.presignedGetObject(
        this.defaultBucket,
        objectKey,
        expirySeconds,
        requestParams,
      );
      return this.getPublicUrl(url);
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned download URL for ${objectKey}`,
        error,
      );
      throw new MinIOConnectionError(
        'Failed to generate presigned download URL',
      );
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    try {
      await this.minioClient.removeObject(this.defaultBucket, objectKey);
    } catch {
      throw new MinIOConnectionError('Failed to delete object from storage');
    }
  }

  async copyObject(
    sourceObjectKey: string,
    destObjectKey: string,
  ): Promise<void> {
    try {
      const conds = new Minio.CopyConditions();
      await this.minioClient.copyObject(
        this.defaultBucket,
        destObjectKey,
        `/${this.defaultBucket}/${sourceObjectKey}`,
        conds,
      );
    } catch {
      throw new MinIOConnectionError('Failed to copy object in storage');
    }
  }

  async statObject(objectKey: string): Promise<{
    size: number;
    contentType?: string;
  }> {
    try {
      const stat = await this.minioClient.statObject(
        this.defaultBucket,
        objectKey,
      );
      const metaData = stat.metaData as Record<string, unknown> | undefined;
      const contentTypeMeta = metaData?.['content-type'];
      return {
        size: Number(stat.size),
        contentType:
          typeof contentTypeMeta === 'string' ? contentTypeMeta : undefined,
      };
    } catch {
      throw new MinIOConnectionError('Failed to stat object from storage');
    }
  }

  /**
   * Initiate a new S3 multipart upload and return the uploadId
   */
  async initiateMultipartUpload(objectKey: string): Promise<string> {
    try {
      const uploadId = await (
        this.minioClient as any
      ).initiateNewMultipartUpload(this.defaultBucket, objectKey, {});
      return uploadId as string;
    } catch (error) {
      this.logger.error(
        `Failed to initiate multipart upload for ${objectKey}`,
        error,
      );
      throw new MinIOConnectionError('Failed to initiate multipart upload');
    }
  }

  /**
   * Generate a presigned URL for uploading a specific part of a multipart upload
   */
  async generatePresignedUrlForPart(
    objectKey: string,
    uploadId: string,
    partNumber: number,
    expirySeconds: number = 86400,
  ): Promise<string> {
    try {
      const url = await this.minioClient.presignedUrl(
        'PUT',
        this.defaultBucket,
        objectKey,
        expirySeconds,
        { uploadId, partNumber: partNumber.toString() },
      );
      return this.getPublicUrl(url);
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned URL for part ${partNumber} of ${objectKey}`,
        error,
      );
      throw new MinIOConnectionError(
        'Failed to generate presigned URL for part upload',
      );
    }
  }

  /**
   * Complete a multipart upload by assembling all parts
   */
  async completeMultipartUpload(
    objectKey: string,
    uploadId: string,
    parts: { part: number; etag: string }[],
  ): Promise<void> {
    try {
      await (this.minioClient as any).completeMultipartUpload(
        this.defaultBucket,
        objectKey,
        uploadId,
        parts,
      );
    } catch (error) {
      this.logger.error(
        `Failed to complete multipart upload for ${objectKey}`,
        error,
      );
      throw new MinIOConnectionError('Failed to complete multipart upload');
    }
  }

  /**
   * Abort an in-progress multipart upload
   */
  async abortMultipartUpload(
    objectKey: string,
    uploadId: string,
  ): Promise<void> {
    try {
      await (this.minioClient as any).abortMultipartUpload(
        this.defaultBucket,
        objectKey,
        uploadId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to abort multipart upload for ${objectKey}`,
        error,
      );
      throw new MinIOConnectionError('Failed to abort multipart upload');
    }
  }

  private escapeFileName(fileName: string): string {
    return fileName.replace(/"/g, '\\"');
  }
}
