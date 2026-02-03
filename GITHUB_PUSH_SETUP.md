# GitHub Push Setup Documentation

## Overview
This Mac is configured to push to GitHub using **HTTPS authentication with macOS Keychain credential storage**. This setup allows `git push` commands to work seamlessly without requiring manual credential entry each time.

## Current Configuration

### Git Remote Setup
- **Remote URL**: `https://github.com/octopuxltd/fx-ss-nt.git`
- **Protocol**: HTTPS (not SSH)
- **Remote name**: `origin`

### Credential Storage
- **Credential helper**: `osxkeychain`
- **Storage location**: macOS Keychain
- **How it works**: Git credentials (username and personal access token) are stored securely in the macOS Keychain, so they don't need to be entered on every push

### Git Version
- **Version**: `2.39.5 (Apple Git-154)`
- **Source**: Apple's Git distribution (comes with Xcode Command Line Tools)

## How Pushes Work

### Standard Push Command
```bash
git push
```

This command works because:
1. Git uses the HTTPS remote URL (`https://github.com/...`)
2. Git checks the macOS Keychain for stored credentials
3. If credentials are found, they're used automatically
4. The push proceeds without prompting for username/password

### What's NOT Being Used
- **SSH keys**: No SSH keys are configured or used
- **SSH URLs**: The remote uses `https://` not `git@github.com:`
- **Manual credential entry**: Not needed due to Keychain storage

## Initial Setup (If Needed)

If another project needs the same setup, configure it as follows:

### 1. Set Remote to HTTPS
```bash
git remote set-url origin https://github.com/username/repository.git
```

### 2. Configure Credential Helper (if not already set)
```bash
git config credential.helper osxkeychain
```

### 3. First Push (Will Prompt for Credentials)
On the first push, Git will prompt for:
- **Username**: Your GitHub username
- **Password**: Your GitHub Personal Access Token (NOT your GitHub password)

After entering credentials once, they're stored in macOS Keychain and won't be needed again.

### 4. Verify Configuration
```bash
# Check remote URL
git remote -v

# Check credential helper
git config credential.helper

# Should show: osxkeychain
```

## Troubleshooting

### If Push Fails with Authentication Error

1. **Check credential helper is set**:
   ```bash
   git config credential.helper
   ```
   Should return: `osxkeychain`

2. **Check remote URL is HTTPS**:
   ```bash
   git remote -v
   ```
   Should show `https://github.com/...` not `git@github.com:...`

3. **Clear stored credentials** (if credentials are wrong):
   ```bash
   git credential-osxkeychain erase
   host=github.com
   protocol=https
   ```
   (Press Enter twice after the last line)

4. **Re-authenticate**: The next push will prompt for credentials again

### If macOS Keychain Access is Denied

- Open **Keychain Access** app
- Search for `github.com`
- Find the `internet password` entry
- Update or delete it as needed
- Or allow access when prompted

## Key Differences from SSH Setup

| Aspect | This Setup (HTTPS + Keychain) | SSH Setup |
|--------|-------------------------------|-----------|
| Remote URL | `https://github.com/...` | `git@github.com:...` |
| Authentication | Personal Access Token | SSH Key |
| Credential Storage | macOS Keychain | SSH Key File |
| Setup Complexity | Simple (just URL + helper) | Requires SSH key generation |
| First Push | Prompts for token | Uses SSH key automatically |

## Summary

**This Mac pushes to GitHub using:**
- ✅ HTTPS protocol (`https://github.com/...`)
- ✅ macOS Keychain credential helper (`credential.helper=osxkeychain`)
- ✅ Stored Personal Access Token (in Keychain)
- ✅ Simple `git push` command (no special flags needed)

**No SSH keys or SSH configuration required.**
