import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';

import { env } from '../config/env';
import type { PutObjectInput, StoredObject } from './object-storage.types';

// Trimmed from donate-server's ObjectStorageService — donate-workers only
// writes receipt PDFs (putObject), it never serves signed download URLs
// (that stays in donate-server, which reads the same object back).
//
// NOTE for local (non-S3) driver mode: this writes to `<cwd>/storage/<key>`
// on whatever machine runs donate-workers. Since donate-server serves
// downloads from *its own* `<cwd>/storage/<key>`, local mode only works
// across the two processes if they share a filesystem/volume at the same
// relative path. Production (S3 driver) doesn't have this issue.
@Injectable()
export class ObjectStorageService {
  private readonly localStorageDir = join(process.cwd(), 'storage');
  private s3Client?: S3Client;

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    const checksum = createHash('sha256').update(input.body).digest('hex');

    if (env.objectStorageDriver === 's3') {
      await this.getS3Client().send(
        new PutObjectCommand({
          Body: input.body,
          Bucket: this.getS3Bucket(),
          ContentDisposition: input.contentDisposition,
          ContentType: input.contentType,
          Key: input.key,
          ServerSideEncryption: 'AES256',
        }),
      );

      return {
        bucket: this.getS3Bucket(),
        checksum,
        contentType: input.contentType,
        key: input.key,
        provider: 's3',
        size: input.body.byteLength,
      };
    }

    const absolutePath = join(this.localStorageDir, input.key);
    await fs.mkdir(dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, input.body);

    return {
      checksum,
      contentType: input.contentType,
      key: input.key,
      provider: 'local',
      size: input.body.byteLength,
    };
  }

  private getS3Bucket() {
    if (!env.s3Bucket) {
      throw new Error(
        'S3_BUCKET must be configured when OBJECT_STORAGE_DRIVER=s3.',
      );
    }

    return env.s3Bucket;
  }

  private getS3Client() {
    if (this.s3Client) {
      return this.s3Client;
    }

    this.s3Client = new S3Client({
      credentials:
        env.s3AccessKeyId && env.s3SecretAccessKey
          ? {
              accessKeyId: env.s3AccessKeyId,
              secretAccessKey: env.s3SecretAccessKey,
            }
          : undefined,
      endpoint: env.s3Endpoint || undefined,
      forcePathStyle: env.s3ForcePathStyle,
      region: env.s3Region,
    });

    return this.s3Client;
  }
}
