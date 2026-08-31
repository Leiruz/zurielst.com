export function resolveBuildSha(_execute, environment = process.env) {
  const environmentSha = environment.BUILD_SHA?.trim()
    || environment.GITHUB_SHA?.trim()
    || environment.CF_PAGES_COMMIT_SHA?.trim();
  if (environmentSha) return environmentSha;
  return 'dev';
}

const buildDate = process.env.BUILD_DATE ?? new Date().toISOString();
const buildSha = resolveBuildSha();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: false,
  reactStrictMode: true,
  env: {
    BUILD_DATE: buildDate,
    BUILD_SHA: buildSha,
  },
};

export default nextConfig;
