import fs from 'fs';
import path from 'path';

describe('Automated Export Validation', () => {
  const exportFiles = [
    'core.exports.ts',
    'security.exports.ts',
    'services.exports.ts',
    'data.exports.ts',
    'utilities.exports.ts',
    'monitoring.exports.ts',
    'websocket.exports.ts',
    'middleware.exports.ts',
    'ui.exports.ts',
    'webhooks.exports.ts',
    'examples.exports.ts',
    'schemas.exports.ts',
    'types.exports.ts',
  ];

  exportFiles.forEach((file) => {
    const filePath = path.resolve(__dirname, '..', file.replace('.ts', ''));
    test(`${file} should not have missing or undefined exports`, async () => {
      let mod;
      try {
        mod = await import(filePath);
      } catch (err) {
        throw new Error(`Failed to import ${file}: ${err}`);
      }
      for (const [key, value] of Object.entries(mod)) {
        expect(value).not.toBeUndefined();
        expect(value).not.toBeNull();
      }
    });
  });
}); 