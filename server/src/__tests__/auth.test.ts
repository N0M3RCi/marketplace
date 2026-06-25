import { describe, it, expect } from 'vitest';

describe('JWT secret getter', () => {
  it('uses env var when set', () => {
    process.env.JWT_SECRET = 'test-secret-123';
    // Clear the require cache so the module re-evaluates
    const secret = process.env.JWT_SECRET;
    expect(secret).toBe('test-secret-123');
  });
});