import { execFileSync } from 'node:child_process';

function resolveBuildSha() {
  const environmentSha = process.env.GITHUB_SHA ?? process.env.CF_PAGES_COMMIT_SHA;
  if (environmentSha) return environmentSha.trim();

  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

const buildDate = process.env.BUILD_DATE ?? new Date().toISOString();
const buildSha = process.env.BUILD_SHA ?? resolveBuildSha();

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
