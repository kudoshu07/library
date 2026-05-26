import "server-only"

import { Octokit } from "@octokit/rest"

/**
 * Tiny wrapper around the GitHub REST/Git Data APIs for committing blog
 * content from the editor UI. We use the Git Data API (not the simpler
 * `repos.createOrUpdateFileContents`) because publishing can require an
 * atomic commit that touches multiple files at once — e.g. when an existing
 * post's slug changes we need to delete the old MDX file and create the new
 * one in the same commit so the site never has both URLs live.
 *
 * Configuration via env:
 *   GITHUB_TOKEN  - Fine-grained PAT with Contents: Read & Write
 *   GITHUB_REPO   - "owner/repo" (e.g. "kudoshu07/library")
 *   GITHUB_BRANCH - branch to commit to (default "main")
 *
 * Commits are authored by "KSL Blog Admin <noreply@vcook.biz>" so they're
 * easy to distinguish from human commits in the log.
 */

const AUTHOR_NAME = "KSL Blog Admin"
const AUTHOR_EMAIL = "noreply@vcook.biz"

export type GitHubConfig = {
  octokit: Octokit
  owner: string
  repo: string
  branch: string
}

export function getGitHubConfig(): GitHubConfig {
  const token = process.env.GITHUB_TOKEN?.trim()
  const repo = process.env.GITHUB_REPO?.trim()
  const branch = process.env.GITHUB_BRANCH?.trim() || "main"
  if (!token) throw new Error("github_not_configured: missing GITHUB_TOKEN")
  if (!repo || !repo.includes("/")) {
    throw new Error("github_not_configured: GITHUB_REPO must be 'owner/repo'")
  }
  const [owner, repoName] = repo.split("/", 2)
  return {
    octokit: new Octokit({ auth: token }),
    owner,
    repo: repoName,
    branch,
  }
}

export type FileChange =
  | { path: string; mode: "100644"; type: "blob"; content: string }
  | { path: string; mode: "100644"; type: "blob"; contentBase64: string }
  | { path: string; sha: null } // deletion

/**
 * Apply a set of file changes (create/update/delete) as a single commit on
 * the configured branch. Returns the new commit SHA.
 *
 * Internally we:
 *  1. Look up the branch tip SHA + its tree SHA
 *  2. Upload any non-text blobs (base64) via `createBlob`
 *  3. Build a new tree on top of the current tree with all the requested
 *     changes (sha:null entries delete files)
 *  4. Create a commit pointing at the new tree, with the branch tip as parent
 *  5. Fast-forward the branch ref to the new commit
 */
export async function commitFileChanges(params: {
  message: string
  changes: FileChange[]
}): Promise<{ commitSha: string; commitUrl: string }> {
  const { octokit, owner, repo, branch } = getGitHubConfig()
  const { message, changes } = params

  if (changes.length === 0) {
    throw new Error("commitFileChanges: changes must be non-empty")
  }

  // 1. Branch tip
  const ref = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  })
  const parentCommitSha = ref.data.object.sha

  const parentCommit = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: parentCommitSha,
  })
  const baseTreeSha = parentCommit.data.tree.sha

  // 2. Upload binary blobs (base64) up-front
  const treeEntries: Array<{
    path: string
    mode: "100644"
    type: "blob"
    sha?: string | null
    content?: string
  }> = []

  for (const change of changes) {
    if ("sha" in change && change.sha === null) {
      treeEntries.push({
        path: change.path,
        mode: "100644",
        type: "blob",
        sha: null,
      })
      continue
    }
    if ("contentBase64" in change) {
      const blob = await octokit.git.createBlob({
        owner,
        repo,
        content: change.contentBase64,
        encoding: "base64",
      })
      treeEntries.push({
        path: change.path,
        mode: "100644",
        type: "blob",
        sha: blob.data.sha,
      })
      continue
    }
    if ("content" in change) {
      treeEntries.push({
        path: change.path,
        mode: "100644",
        type: "blob",
        content: change.content,
      })
    }
  }

  // 3. New tree
  const tree = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: treeEntries,
  })

  // 4. Commit
  const commit = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: tree.data.sha,
    parents: [parentCommitSha],
    author: { name: AUTHOR_NAME, email: AUTHOR_EMAIL },
    committer: { name: AUTHOR_NAME, email: AUTHOR_EMAIL },
  })

  // 5. Fast-forward branch
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commit.data.sha,
  })

  return {
    commitSha: commit.data.sha,
    commitUrl: commit.data.html_url,
  }
}

/**
 * Fetch a file's raw content from the configured branch.
 * Returns null if the file doesn't exist.
 */
export async function getFileContent(filePath: string): Promise<string | null> {
  const { octokit, owner, repo, branch } = getGitHubConfig()
  try {
    const res = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
    })
    const data = res.data as { type?: string; content?: string; encoding?: string }
    if (data.type !== "file" || !data.content) return null
    const encoding = data.encoding ?? "base64"
    if (encoding !== "base64") return null
    return Buffer.from(data.content, "base64").toString("utf-8")
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "status" in err &&
      (err as { status?: number }).status === 404
    ) {
      return null
    }
    throw err
  }
}

/**
 * Check if a file exists in the branch. Cheaper than getFileContent because
 * we don't download the body — we just look up the tree entry SHA.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  const { octokit, owner, repo, branch } = getGitHubConfig()
  try {
    await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
    })
    return true
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "status" in err &&
      (err as { status?: number }).status === 404
    ) {
      return false
    }
    throw err
  }
}
