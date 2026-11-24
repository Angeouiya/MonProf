// Integration runner only: no Next request/cache infrastructure exists in a
// standalone Node process. Execute the real settings loader against local PG.
// No database, authentication, financial or schedule logic is replaced.
export const unstable_cache = (load) => load;
