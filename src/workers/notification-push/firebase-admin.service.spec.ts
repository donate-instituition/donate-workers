import { getApp, getApps, initializeApp } from 'firebase-admin/app';

import { env } from '../../config/env';
import { FirebaseAdminService } from './firebase-admin.service';

const mockSend = jest.fn();

jest.mock('firebase-admin/app', () => ({
  cert: jest.fn((input) => input),
  getApp: jest.fn(() => ({ name: 'existing-app' })),
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(() => ({ name: 'new-app' })),
}));

jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn(() => ({ send: mockSend })),
}));

describe('FirebaseAdminService', () => {
  const originalEnv = { ...env };

  afterEach(() => {
    Object.assign(env, originalEnv);
    jest.clearAllMocks();
  });

  describe('isConfigured', () => {
    it('is false when FCM is disabled even with valid credentials', () => {
      env.fcmEnabled = false;
      env.firebaseServiceAccountJson = '';
      env.firebaseClientEmail = 'a@b.com';
      env.firebasePrivateKey = 'key';
      env.firebaseProjectId = 'proj';
      const service = new FirebaseAdminService();

      expect(service.isConfigured()).toBe(false);
    });

    it('is false when no credentials are configured at all', () => {
      env.fcmEnabled = true;
      env.firebaseServiceAccountJson = '';
      env.firebaseClientEmail = '';
      env.firebasePrivateKey = '';
      env.firebaseProjectId = '';
      const service = new FirebaseAdminService();

      expect(service.isConfigured()).toBe(false);
    });

    it('is true using discrete client-email/private-key/project-id env vars', () => {
      env.fcmEnabled = true;
      env.firebaseServiceAccountJson = '';
      env.firebaseClientEmail = 'a@b.com';
      env.firebasePrivateKey = 'key';
      env.firebaseProjectId = 'proj';
      const service = new FirebaseAdminService();

      expect(service.isConfigured()).toBe(true);
    });

    it('is true using a full service-account JSON blob', () => {
      env.fcmEnabled = true;
      env.firebaseServiceAccountJson = JSON.stringify({
        client_email: 'json@b.com',
        private_key: 'json-key',
        project_id: 'json-proj',
      });
      env.firebaseClientEmail = '';
      env.firebasePrivateKey = '';
      env.firebaseProjectId = '';
      const service = new FirebaseAdminService();

      expect(service.isConfigured()).toBe(true);
    });

    it('falls back to discrete env vars when the JSON blob is missing required fields', () => {
      env.fcmEnabled = true;
      env.firebaseServiceAccountJson = JSON.stringify({
        client_email: 'json@b.com',
      });
      env.firebaseClientEmail = 'a@b.com';
      env.firebasePrivateKey = 'key';
      env.firebaseProjectId = 'proj';
      const service = new FirebaseAdminService();

      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('send', () => {
    it('skips sending and returns undefined when not configured', async () => {
      env.fcmEnabled = false;
      const service = new FirebaseAdminService();

      const result = await service.send({ token: 'tok' } as any);

      expect(result).toBeUndefined();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('initializes a new app when none exists yet, then sends via FCM', async () => {
      env.fcmEnabled = true;
      env.firebaseServiceAccountJson = '';
      env.firebaseClientEmail = 'a@b.com';
      env.firebasePrivateKey = 'key';
      env.firebaseProjectId = 'proj';
      (getApps as jest.Mock).mockReturnValue([]);
      mockSend.mockResolvedValue('message-id-1');
      const service = new FirebaseAdminService();

      const result = await service.send({ token: 'tok' } as any);

      expect(initializeApp).toHaveBeenCalled();
      expect(getApp).not.toHaveBeenCalled();
      expect(result).toBe('message-id-1');
    });

    it('reuses the existing app when one is already initialized', async () => {
      env.fcmEnabled = true;
      env.firebaseServiceAccountJson = '';
      env.firebaseClientEmail = 'a@b.com';
      env.firebasePrivateKey = 'key';
      env.firebaseProjectId = 'proj';
      (getApps as jest.Mock).mockReturnValue([{ name: 'existing' }]);
      mockSend.mockResolvedValue('message-id-2');
      const service = new FirebaseAdminService();

      const result = await service.send({ token: 'tok' } as any);

      expect(getApp).toHaveBeenCalled();
      expect(initializeApp).not.toHaveBeenCalled();
      expect(result).toBe('message-id-2');
    });
  });
});
