# Repository protection (maintainer: @rickseven)

The files in this repository cannot protect the repository by themselves: the blocking is done by GitHub settings.
Apply them once, right after creating the repository. Everything below is done in the web UI under **Settings**.

## 1. Nobody else gets write access

* **Collaborators and teams**: add nobody. A public repository lets anyone read and fork it, but only the owner and
  people you add can push, create releases or change settings.
* If the repository belongs to an **organisation**, give other members the *Read* role only, and keep the
  *Allow forking* option off if you do not want copies.

## 2. Rulesets (Settings, Rules, Rulesets, New ruleset, Import a ruleset)

Import both files from this folder:

| File | Protects | Effect |
|---|---|---|
| `ruleset-main.json` | the default branch | no deletion, no force push, no update except by the repository admin (you) |
| `ruleset-tags.json` | tags `data-*` | release tags cannot be created, moved or deleted except by the repository admin |

The admin role is the only bypass (`actor_id` 5 is the built-in *Admin* role). If the import is refused, create
the same rules by hand: branch ruleset on the default branch with *Restrict deletions*, *Block force pushes* and
*Restrict updates*; tag ruleset on `data-*` with *Restrict creations*, *Restrict updates*, *Restrict deletions*;
bypass list: *Repository admin* only.

## 3. Pull requests

Contributions are not accepted. Under **Settings, General**:

* **Features**: turn off *Wikis*, *Projects* and *Discussions*. Keep *Issues* off too unless you want reports.
* **Pull Requests**: leave defaults; close any pull request you did not open.

If you ever want to review outside changes, add a rule *Require a pull request before merging* with *Require review
from Code Owners* (`CODEOWNERS` names you as owner of every file) and make the `guard / maintainer-only` check required.

## 4. Actions

**Settings, Actions, General**:

* *Fork pull request workflows from outside collaborators*: **Require approval for all outside collaborators**.
* *Workflow permissions*: **Read repository contents and packages permissions**; leave *Allow GitHub Actions to
  create and approve pull requests* off.
* Allow only actions you trust (the guard workflow uses none).

The `guard` workflow in `.github/workflows/guard.yml` fails for every push or pull request that does not come from
`rickseven`, so a violation is visible even if a setting was missed.

## 5. Your account

* Turn on **two-factor authentication** for `rickseven` (a stolen login is the one way around every rule above).
* Use a passkey or hardware key if you can; keep recovery codes offline.
* Never put tokens in this repository. `gh auth login` stores its token outside the repo.

## 6. What stays public on purpose

The catalog, the packs and the scripts must be readable by everyone: the app downloads them without logging in.
Integrity comes from the `sha256` in `catalog.json`, which the app checks before using a pack, and from the rules
above that stop anyone but you from changing `catalog.json` or the release assets.
