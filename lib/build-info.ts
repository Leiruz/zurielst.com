export const BUILD_DATE = process.env.BUILD_DATE ?? new Date().toISOString();
export const BUILD_SHA = process.env.BUILD_SHA ?? 'dev';
