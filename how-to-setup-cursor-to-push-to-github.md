# How to Push to GitHub from Cursor

This guide covers pushing code from Cursor to GitHub.

---

## Prerequisites

- Git installed
- GitHub account
- Repository created on GitHub (e.g. `https://github.com/octopuxltd/project-name`)

---

## Option 1: SSH (Recommended)

SSH avoids entering credentials on each push.

### 1. Check for existing SSH keys

```bash
ls -la ~/.ssh
```

Look for `id_xx00000` and `id_xx00000.pub` (or `id_rsa` / `id_rsa.pub`).

### 2. Create SSH key (if needed)

```bash
ssh-keygen -t xx00000 -C "your_email@example.com" -f ~/.ssh/id_xx00000 -N ""
```

### 3. Add public key to GitHub

1. Copy your public key:
   ```bash
   cat ~/.ssh/id_xx00000.pub
   ```
2. Go to [GitHub → Settings → SSH and GPG keys](https://github.com/settings/keys)
3. Click **New SSH key**
4. Paste the key and save

### 4. Use SSH remote

```bash
cd "/path/to/your/project"
git remote set-url origin git@github.com:USERNAME/REPO.git
```

Example:
```bash
git remote set-url origin git@github.com:octopuxltd/project-name.git
```

### 5. Push

```bash
git add -A
git commit -m "Your commit message"
git push -u origin main
```

---

## Option 2: HTTPS with Personal Access Token

GitHub no longer accepts account passwords for Git. Use a Personal Access Token instead.

### 1. Create a token

1. Go to [GitHub → Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
2. **Tokens (classic)** → **Generate new token (classic)**
3. Name it (e.g. `cursor-push`), set expiration, enable **repo** scope
4. Generate and copy the token

### 2. Use HTTPS remote

```bash
git remote set-url origin https://github.com/USERNAME/REPO.git
```

### 3. Push (use token as password)

When prompted:
- **Username:** your GitHub username
- **Password:** paste your Personal Access Token (not your GitHub password)

```bash
git push -u origin main
```

---

## Common Commands

| Action | Command |
|--------|---------|
| Check status | `git status` |
| Stage all changes | `git add -A` |
| Commit | `git commit -m "message"` |
| Push | `git push origin main` |
| Pull latest | `git pull origin main` |
| View remote | `git remote -v` |

---

## Troubleshooting

### "Authentication failed" / "Invalid username or token"

- **HTTPS:** Use a Personal Access Token, not your GitHub password
- **SSH:** Ensure your public key is added to GitHub and the remote URL is `git@github.com:...`

### "Permission denied (publickey)"

- Start the SSH agent: `eval "$(ssh-agent -s)"` then `ssh-add ~/.ssh/id_xx00000`
- Confirm the key is added: `ssh-add -l`
- Test connection: `ssh -T git@github.com`

### "Device not configured" when pushing from Cursor

Cursor's terminal may not support interactive credential prompts. Use SSH (Option 1) or run `git push` from your system terminal.

---

## Quick Reference for This Project

```bash
cd "'/Users/pannett/Vibe coding/browser'"
git add -A
git commit -m "Your message"
git push origin main
```

**Remote (SSH):** `git@github.com:octopuxltd/project-name.git`