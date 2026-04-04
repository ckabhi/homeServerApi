import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { MinIOConnectionError } from './exceptions/file-errors';

@Injectable()
export class MinioService implements OnModuleInit {
  private minioClient!: Minio.Client;
  private readonly logger = new Logger(MinioService.name);
  private readonly defaultBucket = 'app-bucket';

  constructor(private readonly configService: ConfigService) {}

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
        accessKey: this.configService.get<string>(
          'MINIO_ACCESS_KEY',
          'minioadmin',
        ),
        secretKey: this.configService.get<string>(
          'MINIO_SECRET_KEY',
          'minioadmin',
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
      if (method === 'GET') {
        return await this.minioClient.presignedGetObject(
          this.defaultBucket,
          objectKey,
          expirySeconds,
        );
      } else {
        return await this.minioClient.presignedPutObject(
          this.defaultBucket,
          objectKey,
          expirySeconds,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned URL for ${objectKey}`,
        error,
      );
      throw new MinIOConnectionError('Failed to generate presigned URL');
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
}
