const fs = require("node:fs/promises");
const path = require("node:path");

const USERNAME = process.env.GITHUB_USERNAME || "YelamanKarassay";
const PROFILE_REPO = USERNAME.toLowerCase();
const README_PATH = path.join(process.cwd(), "README.md");
const START_MARKER = "<!-- PROJECTS:START -->";
const END_MARKER = "<!-- PROJECTS:END -->";
const MAX_REPOS = 5;

async function fetchRepos() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": `${USERNAME}-profile-readme-updater`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const url = new URL(`https://api.github.com/users/${USERNAME}/repos`);
  url.searchParams.set("per_page", "100");
  url.searchParams.set("sort", "pushed");
  url.searchParams.set("direction", "desc");

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function cleanDescription(description) {
  return description && description.trim()
    ? description.trim()
    : "Public repository by Yelaman Karassay.";
}

function formatRepo(repo) {
  const language = repo.language ? ` • ${repo.language}` : "";
  return `- [${repo.name}](${repo.html_url})${language}\n  ${cleanDescription(repo.description)}`;
}

function buildProjectsSection(repos) {
  const selectedRepos = repos
    .filter((repo) => !repo.archived)
    .filter((repo) => !repo.fork)
    .filter((repo) => repo.name.toLowerCase() !== PROFILE_REPO)
    .slice(0, MAX_REPOS);

  if (selectedRepos.length === 0) {
    return "_Recent public repositories will appear here automatically._";
  }

  return selectedRepos.map(formatRepo).join("\n\n");
}

function replaceGeneratedSection(readme, generatedContent) {
  const start = readme.indexOf(START_MARKER);
  const end = readme.indexOf(END_MARKER);

  if (start === -1 || end === -1 || end < start) {
    throw new Error("README project markers are missing or out of order.");
  }

  return [
    readme.slice(0, start + START_MARKER.length),
    "\n",
    generatedContent,
    "\n",
    readme.slice(end),
  ].join("");
}

async function main() {
  const [readme, repos] = await Promise.all([fs.readFile(README_PATH, "utf8"), fetchRepos()]);
  const generatedContent = buildProjectsSection(repos);
  const nextReadme = replaceGeneratedSection(readme, generatedContent);

  if (nextReadme !== readme) {
    await fs.writeFile(README_PATH, nextReadme);
    console.log("README.md project section updated.");
    return;
  }

  console.log("README.md project section already up to date.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
