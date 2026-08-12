import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';

import { env } from '../config/env';
import { ObjectStorageService } from './object-storage.service';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('ObjectStorageService', () => {
  const originalEnv = { ...env };

  afterEach(() => {
    Object.assign(env, originalEnv);
    jest.clearAllMocks();
  });

  it('writes to local disk when driver is local (default)', async () => {
    env.objectStorageDriver = 'local';
    const service = new ObjectStorageService();

    const result = await service.putObject({
      body: Buffer.from('hello'),
      contentType: 'application/pdf',
      key: 'receipts/1.pdf',
    });

    expect(fs.mkdir).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        contentType: 'application/pdf',
        key: 'receipts/1.pdf',
        provider: 'local',
      }),
    );
    expect(result.checksum).toEqual(expect.any(String));
    expect(result.bucket).toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('uploads to S3 when driver is s3', async () => {
    env.objectStorageDriver = 's3';
    env.s3Bucket = 'my-bucket';
    mockSend.mockResolvedValue({});
    const service = new ObjectStorageService();

    const result = await service.putObject({
      body: Buffer.from('hello'),
      contentType: 'application/pdf',
      key: 'receipts/1.pdf',
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'my-bucket',
        Key: 'receipts/1.pdf',
        ServerSideEncryption: 'AES256',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ bucket: 'my-bucket', provider: 's3' }),
    );
  });

  it('throws when S3 driver is selected but no bucket is configured', async () => {
    env.objectStorageDriver = 's3';
    env.s3Bucket = '';
    const service = new ObjectStorageService();

    await expect(
      service.putObject({
        body: Buffer.from('x'),
        contentType: 'text/plain',
        key: 'a.txt',
      }),
    ).rejects.toThrow('S3_BUCKET must be configured');
  });

  it('passes explicit credentials to S3Client when access keys are configured', async () => {
    env.objectStorageDriver = 's3';
    env.s3Bucket = 'my-bucket';
    env.s3AccessKeyId = 'AKIA';
    env.s3SecretAccessKey = 'secret';
    mockSend.mockResolvedValue({});
    const service = new ObjectStorageService();

    await service.putObject({
      body: Buffer.from('x'),
      contentType: 'text/plain',
      key: 'a.txt',
    });

    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: { accessKeyId: 'AKIA', secretAccessKey: 'secret' },
      }),
    );
  });

  it('omits credentials when access keys are not configured', async () => {
    env.objectStorageDriver = 's3';
    env.s3Bucket = 'my-bucket';
    env.s3AccessKeyId = '';
    env.s3SecretAccessKey = '';
    mockSend.mockResolvedValue({});
    const service = new ObjectStorageService();

    await service.putObject({
      body: Buffer.from('x'),
      contentType: 'text/plain',
      key: 'a.txt',
    });

    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({ credentials: undefined }),
    );
  });

  it('reuses the cached S3Client across multiple putObject calls', async () => {
    env.objectStorageDriver = 's3';
    env.s3Bucket = 'my-bucket';
    mockSend.mockResolvedValue({});
    const service = new ObjectStorageService();

    await service.putObject({
      body: Buffer.from('x'),
      contentType: 'text/plain',
      key: 'a.txt',
    });
    await service.putObject({
      body: Buffer.from('y'),
      contentType: 'text/plain',
      key: 'b.txt',
    });

    expect(S3Client).toHaveBeenCalledTimes(1);
  });
});
