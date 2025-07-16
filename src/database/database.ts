// Mock database implementation using in-memory storage
export class MockDatabase {
    private stores: Map<string, Map<string | number, any>>;

    constructor() {
        this.stores = new Map();
        // Initialize stores for different models
        this.stores.set('User', new Map());
        this.stores.set('Portfolio', new Map());
        this.stores.set('Order', new Map());
        this.stores.set('MarketData', new Map());
        this.stores.set('Instrument', new Map());
        this.stores.set('TickData', new Map());
        this.stores.set('CandleData', new Map());
        this.stores.set('TimeframeConfig', new Map());
        this.stores.set('Trade', new Map());
        this.stores.set('Position', new Map());
        this.stores.set('TradingSession', new Map());
        this.stores.set('Strategy', new Map());
    }

    // Generic CRUD operations
    async create(model: string, data: any) {
        const store = this.stores.get(model);
        if (!store) throw new Error(`Model ${model} not found`);

        const id = data.id || Date.now().toString();
        store.set(id, { ...data, id });
        return { ...data, id };
    }

    async findUnique(model: string, where: { [key: string]: any }) {
        const store = this.stores.get(model);
        if (!store) throw new Error(`Model ${model} not found`);

        // Simple implementation that only supports id lookup
        if (where.id) {
            return store.get(where.id) || null;
        }

        // Support symbol lookup for instruments
        if (where.symbol) {
            for (const item of store.values()) {
                if (item.symbol === where.symbol) {
                    return item;
                }
            }
        }

        // Support name lookup for timeframes
        if (where.name) {
            for (const item of store.values()) {
                if (item.name === where.name) {
                    return item;
                }
            }
        }

        return null;
    }

    async findFirst(model: string, options: any = {}) {
        const results = await this.findMany(model, { ...options, limit: 1 });
        return results[0] || null;
    }

    async findMany(model: string, options: any = {}) {
        const store = this.stores.get(model);
        if (!store) throw new Error(`Model ${model} not found`);

        let results = Array.from(store.values());

        // Basic where clause support
        if (options.where) {
            results = results.filter(item => {
                return Object.entries(options.where).every(([key, value]) => {
                    if (typeof value === 'object' && value !== null) {
                        // Handle nested conditions like timestamp: { gte: date, lt: date }
                        const valueObj = value as any;
                        if (valueObj.gte || valueObj.lt || valueObj.lte || valueObj.gt) {
                            const itemValue = new Date(item[key]);
                            if (valueObj.gte && itemValue < new Date(valueObj.gte)) return false;
                            if (valueObj.gt && itemValue <= new Date(valueObj.gt)) return false;
                            if (valueObj.lte && itemValue > new Date(valueObj.lte)) return false;
                            if (valueObj.lt && itemValue >= new Date(valueObj.lt)) return false;
                            return true;
                        }
                        // Handle other nested conditions
                        return Object.entries(valueObj).every(([nestedKey, nestedValue]) =>
                            item[key]?.[nestedKey] === nestedValue
                        );
                    }
                    return item[key] === value;
                });
            });
        }

        // Basic orderBy support
        if (options.orderBy) {
            const orderByEntries = Object.entries(options.orderBy);
            if (orderByEntries.length > 0) {
                const [field, order] = orderByEntries[0] as [string, 'asc' | 'desc'];
                results.sort((a, b) => {
                    const aVal = a[field];
                    const bVal = b[field];
                    if (order === 'asc') return aVal > bVal ? 1 : -1;
                    return aVal < bVal ? 1 : -1;
                });
            }
        }

        // Support limit
        if (options.limit) {
            results = results.slice(0, options.limit);
        }

        // Support take (alias for limit)
        if (options.take) {
            results = results.slice(0, options.take);
        }

        return results;
    }

    async update(model: string, where: { [key: string]: any }, data: any) {
        const store = this.stores.get(model);
        if (!store) throw new Error(`Model ${model} not found`);

        if (where.id) {
            const existing = store.get(where.id);
            if (!existing) throw new Error(`Record not found`);

            const updated = { ...existing, ...data };
            store.set(where.id, updated);
            return updated;
        }
        throw new Error('Only id-based updates are supported');
    }

    async upsert(model: string, where: { [key: string]: any }, create: any, update: any) {
        const existing = await this.findUnique(model, where);

        if (existing) {
            return await this.update(model, where, update);
        } else {
            return await this.create(model, { ...create, ...where });
        }
    }

    async delete(model: string, where: { [key: string]: any }) {
        const store = this.stores.get(model);
        if (!store) throw new Error(`Model ${model} not found`);

        if (where.id) {
            const existing = store.get(where.id);
            if (!existing) throw new Error(`Record not found`);

            store.delete(where.id);
            return existing;
        }
        throw new Error('Only id-based deletes are supported');
    }

    async deleteMany(model: string, where: { [key: string]: any }) {
        const itemsToDelete = await this.findMany(model, { where });
        const store = this.stores.get(model);
        if (!store) throw new Error(`Model ${model} not found`);

        for (const item of itemsToDelete) {
            store.delete(item.id);
        }

        return { count: itemsToDelete.length };
    }

    async count(model: string, where: { [key: string]: any } = {}) {
        const results = await this.findMany(model, { where });
        return results.length;
    }

    // Transaction simulation
    async $transaction(operations: (() => Promise<any>)[]) {
        // Simple implementation that just runs operations in sequence
        const results = [];
        for (const operation of operations) {
            results.push(await operation());
        }
        return results;
    }

    // Helper to clear all data (useful for testing)
    async clearAll() {
        this.stores.forEach(store => store.clear());
    }
}

// Create a singleton instance of MockDatabase
const mockDb = new MockDatabase();

// Export the mock database instance with a similar interface to Prisma
export const db = mockDb; 