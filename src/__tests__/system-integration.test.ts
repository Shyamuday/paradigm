import { initializeParadigmSystem, quickStart } from '../index';

describe('Paradigm Trading System Integration', () => {
  let system: any;

  it('should initialize the system with initializeParadigmSystem()', async () => {
    system = await initializeParadigmSystem();
    expect(system).toBeDefined();
    expect(system.services).toBeDefined();
    expect(system.middleware).toBeDefined();
    expect(system.strategies).toBeDefined();
    expect(system.examples).toBeDefined();
    // Optionally check a core service
    expect(system.services.config).toBeDefined();
  });

  it('should initialize and start the system with quickStart()', async () => {
    const quickSystem = await quickStart();
    expect(quickSystem).toBeDefined();
    expect(quickSystem.services).toBeDefined();
    expect(quickSystem.middleware).toBeDefined();
    expect(quickSystem.strategies).toBeDefined();
    expect(quickSystem.examples).toBeDefined();
  });

  it('should shutdown the system gracefully', async () => {
    if (system && typeof system.shutdown === 'function') {
      await expect(system.shutdown()).resolves.not.toThrow();
    }
  });
}); 