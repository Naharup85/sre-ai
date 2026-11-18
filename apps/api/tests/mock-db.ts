export interface MockUserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export const mockUsersStore: MockUserRecord[] = [];

export function resetMockUsers() {
  mockUsersStore.length = 0;
}

function projectUser(user: MockUserRecord, fields?: Record<string, any>) {
  if (!fields) {
    return { ...user };
  }
  const result: Record<string, any> = {};
  for (const key of Object.keys(fields)) {
    result[key] = (user as any)[key];
  }
  return result;
}

export const mockDb = {
  select: (fields?: Record<string, any>) => ({
    from: (_table: unknown) => ({
      where: (condition: unknown) => ({
        limit: async (_limitCount: number) => {
          const colName = (condition as any)?.queryChunks?.[1]?.name;
          const colVal = (condition as any)?.queryChunks?.[3]?.value;

          let found: MockUserRecord | undefined;
          if (colName === "email") {
            found = mockUsersStore.find((u) => u.email === colVal);
          } else if (colName === "id") {
            found = mockUsersStore.find((u) => u.id === colVal);
          }

          if (!found) return [];
          return [projectUser(found, fields)];
        },
      }),
    }),
  }),
  insert: (_table: unknown) => ({
    values: (data: { name: string; email: string; passwordHash: string }) => ({
      returning: async (fields?: Record<string, any>) => {
        const newUser: MockUserRecord = {
          id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: data.name,
          email: data.email,
          passwordHash: data.passwordHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockUsersStore.push(newUser);
        return [projectUser(newUser, fields)];
      },
    }),
  }),
};
