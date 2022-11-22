# delete-old-releases

This action provides the following functionality for GitHub Actions users:

- Deleting old releases from a repository.
- Optionally removing the tags associated with the removed releases.
- Optionally keeping the latest patch of each older minor versions.
- Configuring how many releases to keep.

# Usage

See [action.yml](https://github.com/Nats-ji/delete-old-releases/blob/master/action.yml)

```yml
steps:
- uses: actions/checkout@v3
- uses: Nats-ji/delete-old-releases@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    keep-count: 5
    keep-old-minor-releases: true
    keep-old-minor-releases-count: 1
```

# Input
| Input | Required | Default | Description |
| --- | --- | --- | --- |
| token | Yes | | Your Github token. Can be abtained by using `${{ secrets.GITHUB_TOKEN }}` |
| keep-count | No | 3 | Number of releases to keep. |
| keep-old-minor-releases | Yes | true | Keep the latest release of each older minor versions. |
| keep-old-minor-releases-by | No | 'minor' | Which semver level should we use to keep old release? Can be: `'major'`, `'minor'`, or `'patch'`. |
| keep-old-minor-releases-count | No | 1 | Number of old releases in each minor version to keep. |
| include-prerelease | No | false | Always include prerelease versions. ([node-semver](https://docs.npmjs.com/cli/v6/using-npm/semver#functions))|
| semver-loose | No | false | Interpret versions and ranges loosely. ([node-semver](https://docs.npmjs.com/cli/v6/using-npm/semver#functions))|
| remove-tags | No | false | Also remove the tags associated with the removed releases. |
| dry-run | No | false | Doesn't delete anything. Only a test run. |

## Example
Say you have the following versions in your release:
```js
[
    2.1.5, 2.1.4, 2.1.3, 2.1.2, 2.1.1, 2.1.0,
    2.0.3, 2.0.2, 2.0.1, 2.0.0,
    1.2.3, 1.2.2, 1.2.1, 1.2.0,
    1.1.3, 1.1.2, 1.1.1, 1.1.0,
    1.0.1, 1.0.0,
]
```

### Only keep the newest releases

The following config will delete all but `2.1.5, 2.1.4`:

```yml
- uses: Nats-ji/delete-old-releases@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    keep-count: 2
    keep-old-minor-releases: false
```

### Keep older minor releases

The following config will delete all but `2.1.5, 2.1.4, 2.0.3, 1.2.3, 1.1.3, 1.0.1`: 

```yml
- uses: Nats-ji/delete-old-releases@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    keep-count: 2
    keep-old-minor-releases: true
```

The following config will delete all but `2.1.5, 2.1.4, 2.0.3, 1.2.3`: 

```yml
- uses: Nats-ji/delete-old-releases@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    keep-count: 2
    keep-old-minor-releases: true
    keep-old-minor-releases-by: 'major'
```

# License

The scripts and documentation in this project are released under the [MIT License](https://github.com/Nats-ji/delete-old-releases/blob/master/LICENSE)

# Contributions

Contributions are welcome!