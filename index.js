const core = require("@actions/core");
const github = require("@actions/github");
const semver = require("semver");

const Options = {
  token: "",
  keepCount: 3,
  keepOld: true,
  keepOldBy: 2, // major: 1, minor: 2, patch: 3
  keepOldCount: 1,
  removeTags: false,
  dryRun: false,
};

const SemverOption = {
  loose: false,
  includePrerelease: false,
};

function formatSemver(str) {
  const reg = /^v?\d+(\.?\d+)?(\.?\d+)?/;
  const match = str.match(reg);
  if (!match) return str;
  let match_str = match[0];
  let levels = match_str.split(".").length - 1;
  while (levels < 2) {
    match_str += ".0";
    levels++;
  }
  return str.replace(match[0], match_str);
}

async function getReleaseListFromGithub(owner, repo, page, outputObj) {
  const octokit = github.getOctokit(Options.token);
  try {
    var { data } = await octokit.rest.repos.listReleases({
      owner: owner,
      repo: repo,
      per_page: 100,
      page: page,
    });
  } catch (error) {
    core.setFailed(error.message);
  }
  for (const release of data) {
    outputObj[release.tag_name] = release.id;
  }
  console.log(`Page: ${page}, length: ${data.length}`);
  if (data.length === 100) {
    await getReleaseListFromGithub(owner, repo, page + 1, outputObj);
  }
}

function parseReleaseTreeFromList(releases, outputObj) {
  for (const tag_name in releases) {
    const version = semver.parse(
      semver.valid(tag_name) || formatSemver(tag_name),
      SemverOption
    );

    // check if parse success
    if (!version) {
      // skip if version is unparseable
      console.log(`Skipped unparseable version: ${tag_name}`);
      continue;
    }

    const major_str = version.major.toString();
    const minor_str = version.minor.toString();
    const patch_str = version.patch.toString();

    switch (Options.keepOldBy) {
      case 1:
        if (!outputObj.hasOwnProperty(major_str)) outputObj[major_str] = [];

        outputObj[major_str].push({
          id: releases[tag_name],
          version: tag_name,
        });
        break;
      case 2:
        if (!outputObj.hasOwnProperty(major_str)) {
          outputObj[major_str] = {};
        }
        if (!outputObj[major_str].hasOwnProperty(minor_str)) {
          outputObj[major_str][minor_str] = [];
        }

        outputObj[major_str][minor_str].push({
          id: releases[tag_name],
          version: tag_name,
        });
        break;
      case 3:
        if (!outputObj.hasOwnProperty(major_str)) {
          outputObj[major_str] = {};
        }
        if (!outputObj[major_str].hasOwnProperty(minor_str)) {
          outputObj[major_str][minor_str] = {};
        }
        if (!outputObj[major_str][minor_str].hasOwnProperty(patch_str))
          outputObj[major_str][minor_str][patch_str] = [];

        outputObj[major_str][minor_str][patch_str].push({
          id: releases[tag_name],
          version: tag_name,
        });
        break;
    }
  }
}

function sortSemverInTreeList(treeList) {
  treeList.sort((a, b) => {
    if (
      semver.lt(
        semver.valid(a.version) || formatSemver(a.version),
        semver.valid(b.version) || formatSemver(b.version),
        SemverOption
      )
    )
      return 1;
    else return -1;
  });
}

function getLatestReleasesToKeep(release_tree) {
  const ver_numbers = [];
  for (const ver_number in release_tree) {
    ver_numbers.push(ver_number);
  }
  ver_numbers.sort((a, b) => {
    return Number(b) - Number(a);
  });
  const latest_ver = release_tree[ver_numbers[0]];
  if (Array.isArray(latest_ver)) {
    sortSemverInTreeList(latest_ver);
    const releases_to_keep = latest_ver.slice(0, Options.keepCount);
    releases_to_keep.forEach((ele, idx, arr) => {
      arr[idx] = ele.version;
    });
    delete release_tree[ver_numbers[0]];
    return releases_to_keep;
  } else {
    return getLatestReleasesToKeep(latest_ver);
  }
}

function getOldReleasesToKeep(release_tree, outKeepList) {
  for (const ver_number in release_tree) {
    const ver_level = release_tree[ver_number];
    if (Array.isArray(ver_level)) {
      sortSemverInTreeList(ver_level);
      const releases_to_keep = ver_level.slice(0, Options.keepOldCount);
      releases_to_keep.forEach((ele, idx, arr) => {
        arr[idx] = ele.version;
      });
      outKeepList.push(...releases_to_keep);
    } else {
      getOldReleasesToKeep(ver_level, outKeepList);
    }
  }
}

function delReleasesFromList(releaseTree, outReleaseList) {
  const releasesToKeep = [];
  // list latest major release to keep then remove them from release list
  releasesToKeep.push(...getLatestReleasesToKeep(releaseTree));

  if (Options.keepOld) {
    getOldReleasesToKeep(releaseTree, releasesToKeep);
  }

  releasesToKeep.forEach((ver) => {
    delete outReleaseList[ver];
  });

  console.log("Tags to keep:");
  console.log(releasesToKeep);
}

async function deleteReleasesFromGithub(owner, repo, releases) {
  const octokit = github.getOctokit(Options.token);
  const promises = [];
  const tags = [];
  let i = 1;
  for (const version in releases) {
    if (i > 3) break;
    const res = octokit.rest.repos.getRelease({
      owner: owner,
      repo: repo,
      release_id: releases[version],
    });
    promises.push(res);
    tags.push(version);
    i++;
  }
  await Promise.allSettled(promises).then((results) =>
    results.forEach((result, idx) => {
      if (result.status === "rejected")
        console.log(
          `Failed to delete release: ${tags[idx]}, reason: ${result.reason}`
        );
      if (result.status === "fulfilled")
        console.log(`Deleted release: ${tags[idx]}.`);
    })
  );
}

async function deleteTagsFromGithub(owner, repo, releases) {
  const octokit = github.getOctokit(Options.token);
  const promises = [];
  const tags = [];
  let i = 1;
  for (const version in releases) {
    if (i > 3) break;
    const res = octokit.rest.repos.getReleaseByTag({
      owner: owner,
      repo: repo,
      tag: version,
    });
    promises.push(res);
    tags.push(version);
    i++;
  }
  await Promise.allSettled(promises).then((results) =>
    results.forEach((result, idx) => {
      if (result.status === "rejected")
        console.log(
          `Failed to delete tag: ${tags[idx]}, reason: ${result.reason}`
        );
      if (result.status === "fulfilled")
        console.log(`Deleted tag: ${tags[idx]}.`);
    })
  );
}

async function run() {
  const owner = github.context.repo.owner;
  const repo = github.context.repo.repo;
  const releases = {};
  console.log("Getting releases from Github.");
  await getReleaseListFromGithub(owner, repo, 1, releases);
  console.log("Done.");

  if (Object.keys(releases).length === 0) {
    console.log("This repo doesn't have any releases.");
    return;
  }

  const release_tree = {};
  console.log("Parsing the release tree.");
  parseReleaseTreeFromList(releases, release_tree);
  console.log("Done.");

  console.log("Calculating releases to delete.");
  delReleasesFromList(release_tree, releases);

  if (Object.keys(releases).length === 0) {
    console.log("No tags to delete");
    return;
  }

  console.log("Tags to delete:");
  console.log(releases);
  console.log("Done.");

  console.log("Deleting releases from Github.");
  if (!Options.dryRun) await deleteReleasesFromGithub(owner, repo, releases);
  console.log("Done.");

  if (Options.removeTags) {
    console.log("Deleting tags from Github.");
    if (!Options.dryRun) await deleteTagsFromGithub(owner, repo, releases);
    console.log("Done.");
  }
}

try {
  // load options
  Options.token = core.getInput("token");
  Options.keepCount = core.getInput("keep-count");
  Options.keepOld = core.getInput("keep-old-minor-releases");
  Options.keepOldBy =
    core.getInput("keep-old-minor-releases-by") === "major"
      ? 1
      : core.getInput("keep-old-minor-releases-by") === "patch"
      ? 3
      : 2;
  Options.keepOldCount = core.getInput("keep-old-minor-releases-count");
  Options.removeTags = core.getInput("remove-tags");
  Options.dryRun = core.getInput("dry-run");
  SemverOption.loose = core.getInput("semver-loose");
  SemverOption.includePrerelease = core.getInput("include-prerelease");

  run();
} catch (error) {
  core.setFailed(error.message);
}
