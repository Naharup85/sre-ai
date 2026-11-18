import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const dialect = new PgDialect();

export interface MockUserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockInstallationRecord {
  id: string;
  userId: string;
  installationId: string;
  accountLogin: string;
  accountType: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockRepositoryRecord {
  id: string;
  userId: string;
  installationId: string;
  githubRepoId: number;
  name: string;
  fullName: string;
  ownerLogin: string;
  defaultBranch: string;
  isPrivate: boolean;
  htmlUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export const mockUsersStore: MockUserRecord[] = [];
export const mockInstallationsStore: MockInstallationRecord[] = [];
export const mockRepositoriesStore: MockRepositoryRecord[] = [];

export function resetMockUsers() {
  mockUsersStore.length = 0;
  mockInstallationsStore.length = 0;
  mockRepositoriesStore.length = 0;
}

function getStoreForTable(tableName: string): any[] {
  if (tableName === "users") return mockUsersStore;
  if (tableName === "github_installations") return mockInstallationsStore;
  if (tableName === "repositories") return mockRepositoriesStore;
  return [];
}

function matchCondition(record: any, condition: any): boolean {
  if (!condition) return true;
  try {
    const { sql, params } = dialect.sqlToQuery(condition);
    const regex = /"([^"]+)"\."([^"]+)" = \$(\d+)/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(sql)) !== null) {
      const colName = m[2];
      const camel = colName.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
      const paramVal = params[parseInt(m[3]) - 1];
      if (record[camel] != paramVal && record[colName] != paramVal) {
        return false;
      }
    }
    return true;
  } catch {
    return true;
  }
}

function projectRecord(record: any, fields?: Record<string, any>) {
  if (!fields) return { ...record };
  const res: Record<string, any> = {};
  for (const k of Object.keys(fields)) {
    res[k] = record[k];
  }
  return res;
}

export const mockDb = {
  select: (fields?: Record<string, any>) => ({
    from: (table: unknown) => {
      const tableName = getTableName(table as any);
      const store = getStoreForTable(tableName);

      const queryObj = {
        where: (condition: unknown) => {
          const filtered = store.filter((item) => matchCondition(item, condition));
          return {
            limit: async (_limitCount: number) => {
              const res = filtered.slice(0, _limitCount);
              return res.map((r) => projectRecord(r, fields));
            },
            orderBy: async (_orderField: unknown) => {
              // Return reverse order (desc)
              const sorted = [...filtered].reverse();
              return sorted.map((r) => projectRecord(r, fields));
            },
            then: (resolve: (val: any) => any, reject?: (err: any) => any) => {
              return Promise.resolve(filtered.map((r) => projectRecord(r, fields))).then(resolve, reject);
            },
          };
        },
        orderBy: async (_orderField: unknown) => {
          const sorted = [...store].reverse();
          return sorted.map((r) => projectRecord(r, fields));
        },
        limit: async (_limitCount: number) => {
          return store.slice(0, _limitCount).map((r) => projectRecord(r, fields));
        },
        then: (resolve: (val: any) => any, reject?: (err: any) => any) => {
          return Promise.resolve(store.map((r) => projectRecord(r, fields))).then(resolve, reject);
        },
      };

      return queryObj;
    },
  }),

  insert: (table: unknown) => {
    const tableName = getTableName(table as any);
    const store = getStoreForTable(tableName);

    return {
      values: (data: any) => ({
        returning: async (fields?: Record<string, any>) => {
          const newId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const newRecord = {
            id: newId,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          store.push(newRecord);
          return [projectRecord(newRecord, fields)];
        },
      }),
    };
  },

  update: (table: unknown) => {
    const tableName = getTableName(table as any);
    const store = getStoreForTable(tableName);

    return {
      set: (data: any) => ({
        where: (condition: unknown) => ({
          returning: async (fields?: Record<string, any>) => {
            const foundIdx = store.findIndex((item) => matchCondition(item, condition));
            if (foundIdx === -1) return [];
            store[foundIdx] = {
              ...store[foundIdx],
              ...data,
              updatedAt: new Date(),
            };
            return [projectRecord(store[foundIdx], fields)];
          },
        }),
      }),
    };
  },

  delete: (table: unknown) => {
    const tableName = getTableName(table as any);
    const store = getStoreForTable(tableName);

    return {
      where: async (condition: unknown) => {
        const toDeleteIndices = store
          .map((item, idx) => (matchCondition(item, condition) ? idx : -1))
          .filter((idx) => idx !== -1)
          .reverse();

        for (const idx of toDeleteIndices) {
          const removed = store.splice(idx, 1)[0];
          // If deleting installation, cascade to repositories
          if (tableName === "github_installations") {
            const repoIndices = mockRepositoriesStore
              .map((r, rIdx) => (r.installationId === removed.id ? rIdx : -1))
              .filter((rIdx) => rIdx !== -1)
              .reverse();
            for (const rIdx of repoIndices) {
              mockRepositoriesStore.splice(rIdx, 1);
            }
          }
        }
        return [];
      },
    };
  },
};
