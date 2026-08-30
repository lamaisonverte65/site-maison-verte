export function createAuthSupabase({ authUser = null, authError = null, adminUser = null, profiles = null, adminError = null } = {}) {
  const storedProfiles = profiles || (adminUser ? [adminUser] : []);
  const state = { profileReads: 0, profileQueries: [] };
  const client = {
    auth: {
      async getUser() {
        return { data: { user: authUser }, error: authError };
      },
    },
    from(table) {
      if (table !== "admin_users") throw new Error(`Unexpected table: ${table}`);
      return {
        select() {
          const conditions = [];
          const matching = () => storedProfiles.filter((profile) => (
            conditions.every(({ field, value }) => profile?.[field] === value)
          ));
          const query = {
            eq(field, value) {
              conditions.push({ field, value });
              state.profileQueries.push({ field, value });
              return query;
            },
            async maybeSingle() {
              state.profileReads += 1;
              const rows = matching();
              if (rows.length > 1) return { data: null, error: { message: "Multiple profiles matched" } };
              return { data: rows[0] || null, error: adminError };
            },
            then(resolve, reject) {
              state.profileReads += 1;
              return Promise.resolve({ data: matching(), error: adminError }).then(resolve, reject);
            },
          };
          return query;
        },
      };
    },
  };
  return { client, state };
}

export function bearerEvent(token = "valid-token") {
  return { headers: token ? { authorization: `Bearer ${token}` } : {} };
}
