# Git Hooks

This folder includes two hooks that are useful if you are committing your sensitive files to a private repo, but also have an upstream `$public_branch` tracking a public repo (that should not contain sensitive data).

- The pre-commit-msg hook checks for any files under a sensitive route (anything other than `/routes/public`) being committed to `$public_branch`. Options are given to force the commit.
- The pre-merge-commit hook checks if the merge is being completed from a private branch into `$public_branch`.

## Before you start:

1. Open each of the hook files and check the settings at the top of the file are correct. Note the default branch name `$public_branch` is **"public"**.
2. Install the hooks into your `.git/hooks` folder
```sh
# ensure you're in the project root first
# for checking commits
cp githooks/prepare-commit-msg .git/hooks/
# for checking merges
cp githooks/pre-merge-commit .git/hooks/
```

2. Ensure the hooks are executable
```sh
# ensure you're in the project root first
chmod -R +x .git/hooks
```

3. If you are using the **pre-merge-commit** hook, you'll need to disable fast-forwards on merges on `$public_branch`:
```sh
# changed the defaults? replace "public" with your $public_branch name
git config branch.public.mergeoptions "--no-ff"
```
