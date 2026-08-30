import { execFileSync } from 'node:child_process';

export function resolveBuildSha(execute = execFileSync, environment = process.env) {
  const environmentSha = environment.BUILD_SHA?.trim()
    || environment.GITHUB_SHA?.trim()
    || environment.CF_PAGES_COMMIT_SHA?.trim();
  if (environmentSha) return environmentSha;

  try {
    return execute('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
      || 'unknown';
  } catch {
    // A source archive or restricted build environment may not expose Git.
    return 'unknown';
  }
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
