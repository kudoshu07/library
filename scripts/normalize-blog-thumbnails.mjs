import fs from "node:fs/promises"
import path from "node:path"

const ROOT = process.cwd()
const BLOG_DIR = path.join(ROOT, "content", "blog")
const PUBLIC_DIR = path.join(ROOT, "public")

const asciiOnly = (s) => /^[\x00-\x7F]+$/.test(s)

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(full)))
      continue
    }
    if (entry.isFile() && full.endsWith(".mdx")) {
      files.push(full)
    }
  }
  return files
}

async function findActualFile(absPath) {
  try {
    await fs.access(absPath)
    return absPath
  } catch {
    // Try filename match with Unicode normalization in the same directory.
    const dir = path.dirname(absPath)
    const wanted = path.basename(absPath)
    const wantedNfc = wanted.normalize("NFC")
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return null
    }
    const match = entries.find(
      (e) => e.isFile() && e.name.normalize("NFC") === wantedNfc,
    )
    return match ? path.join(dir, match.name) : null
  }
}

async function main() {
  const mdxFiles = await walk(BLOG_DIR)
  const summary = {
    scanned: mdxFiles.length,
    targetMdx: 0,
    renamedFiles: 0,
    updatedMdx: 0,
    skippedTargetExists: 0,
    missingSourceFiles: [],
  }

  for (const mdxPath of mdxFiles) {
    const text = await fs.readFile(mdxPath, "utf8")
    const match = text.match(/^thumbnail:\s*(['"])(.+?)\1$/m)
    if (!match) continue

    const [, quote, thumbUrl] = match
    if (!thumbUrl.startsWith("/wp-content/uploads/")) continue

    const parsed = path.posix.parse(thumbUrl)
    if (asciiOnly(parsed.base)) continue

    summary.targetMdx += 1

    const slug = path.basename(mdxPath, ".mdx")
    const newBase = `${slug}-thumbnail${parsed.ext}`
    const newUrl = path.posix.join(parsed.dir, newBase)

    if (thumbUrl === newUrl) continue

    const srcAbsCandidate = path.join(PUBLIC_DIR, thumbUrl.replace(/^\/+/, ""))
    const dstAbs = path.join(PUBLIC_DIR, newUrl.replace(/^\/+/, ""))
    const srcAbs = await findActualFile(srcAbsCandidate)

    let canUpdate = false
    try {
      await fs.access(dstAbs)
      summary.skippedTargetExists += 1
      canUpdate = true
    } catch {
      if (srcAbs) {
        await fs.rename(srcAbs, dstAbs)
        summary.renamedFiles += 1
        canUpdate = true
      } else {
        summary.missingSourceFiles.push({
          mdx: path.relative(ROOT, mdxPath),
          thumbnail: thumbUrl,
        })
      }
    }

    if (!canUpdate) continue

    const newLine = `thumbnail: ${quote}${newUrl}${quote}`
    const updated = text.replace(match[0], newLine)
    if (updated !== text) {
      await fs.writeFile(mdxPath, updated)
      summary.updatedMdx += 1
    }
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
