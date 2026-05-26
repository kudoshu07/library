/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Serverless function bundle hygiene.
  // The /api/admin/blog/* routes use process.cwd() to read MDX from
  // content/blog/, which makes Next's automatic file tracer cast a wide net
  // and pull in the entire project root — including the 260 MB+ public/
  // directory of blog images. That blows past Vercel's 250 MB unzipped
  // serverless function limit and the production build fails.
  //
  // - excludes: public/** is never needed inside a function (it's served by
  //   the CDN), and SWC/esbuild cross-platform binaries are pulled in even
  //   though only the linux build runs on Vercel.
  // - includes: be explicit about the only thing those two routes actually
  //   need from outside their own dependency graph: the MDX source files.
  outputFileTracingExcludes: {
    "*": [
      "public/**",
      ".next/cache/**",
      "node_modules/@swc/core-darwin-*",
      "node_modules/@swc/core-win32-*",
      "node_modules/@esbuild/darwin-*",
      "node_modules/@esbuild/win32-*",
    ],
  },
  outputFileTracingIncludes: {
    "/api/admin/blog/known-tags": ["./content/blog/**/*.mdx"],
    "/api/admin/blog/import-from-mdx": ["./content/blog/**/*.mdx"],
  },
}

export default nextConfig
