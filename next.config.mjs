import { execFileSync } from 'node:child_process';

export function resolveBuildSha(execute = execFileSync, environment = process.env) {
  try {
    const discoveredSha = execute('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    if (discoveredSha) return discoveredSha;
  } catch {
    // A source archive or restricted build environment may not expose Git.
  }

  return environment.BUILD_SHA?.trim()
    || environment.GITHUB_SHA?.trim()
    || 'unknown';
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
