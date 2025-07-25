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
    test(`${file} should not have missing or undefined exports`, () => {
      const filePath = path.resolve(__dirname, '..', file);

      // Check if file exists
      expect(fs.existsSync(filePath)).toBe(true);

      // Read file content
      const content = fs.readFileSync(filePath, 'utf8');

      // Check for basic export syntax
      expect(content).toMatch(/export\s+/);

      // Check for common export patterns
      const exportPatterns = [
        /export\s+\{[^}]*\}/, // named exports
        /export\s+\*/, // re-export all
        /export\s+default/, // default exports
        /export\s+class/, // class exports
        /export\s+function/, // function exports
        /export\s+const/, // const exports
        /export\s+let/, // let exports
        /export\s+var/, // var exports
        /export\s+interface/, // interface exports
        /export\s+type/, // type exports
      ];

      const hasValidExports = exportPatterns.some(pattern => pattern.test(content));
      expect(hasValidExports).toBe(true);

      // Check for common issues
      expect(content).not.toMatch(/export\s+undefined/);
      expect(content).not.toMatch(/export\s+null/);
    });
  });
}); 