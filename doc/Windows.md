# Windows Installation Guide / Windows 安装指南

Soulseed runs on Windows via **WSL2** (recommended) or **Git Bash**. The `./ss` entry point is a bash script, and the memory engine calls the `sqlite3` CLI — both require a Unix-like environment or manual setup.

> Soulseed 在 Windows 上通过 **WSL2**（推荐）或 **Git Bash** 运行。`./ss` 是 bash 脚本，内存引擎调用 `sqlite3` CLI，两者都需要类 Unix 环境或手动安装。

---

## Option A — WSL2 (Recommended) / WSL2（推荐）

WSL2 gives you a full Linux environment. Everything works exactly like the Linux/macOS instructions.

> WSL2 提供完整 Linux 环境，和 Linux/macOS 安装步骤完全一致。

### 1. Enable WSL2

Open PowerShell as Administrator:

```powershell
wsl --install
```

Restart when prompted. This installs Ubuntu by default.

### 2. Open Ubuntu and install Node.js 18+

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should be v20.x or higher
```

### 3. Install sqlite3

```bash
sudo apt-get install -y sqlite3
sqlite3 --version
```

### 4. Clone and run

```bash
git clone <repo-url>
cd Soul-seed
npm install
npm run build
./ss new Aria
```

---

## Option B — Git Bash + Manual sqlite3

If you prefer not to use WSL2, Git Bash + a standalone sqlite3 binary works.

> 如果不想用 WSL2，Git Bash + 独立 sqlite3 二进制文件也可以运行。

### 1. Install Node.js 18+

Download the Windows installer from [nodejs.org](https://nodejs.org/). Choose the LTS version.

### 2. Install Git Bash

Download from [git-scm.com](https://git-scm.com/). During install, select **"Git Bash Here"** and **"Use Git from the Windows Command Prompt"**.

### 3. Install sqlite3 CLI

**Option 1 — winget (Windows 11 / updated Windows 10):**

```powershell
winget install SQLite.SQLite
```

**Option 2 — Manual download:**

1. Go to [sqlite.org/download.html](https://sqlite.org/download.html)
2. Download **sqlite-tools-win-x64-\*.zip** under "Precompiled Binaries for Windows"
3. Extract and copy `sqlite3.exe` to a directory on your PATH (e.g., `C:\Windows\System32` or a folder you add to PATH)

Verify:

```bash
sqlite3 --version
```

### 4. Clone and run (in Git Bash)

```bash
git clone <repo-url>
cd Soul-seed
npm install
npm run build
./ss new Aria
```

> **Note:** Always use **Git Bash**, not PowerShell or CMD, to run `./ss`. PowerShell cannot execute bash scripts directly.
> **注意：** 始终在 **Git Bash** 中运行 `./ss`，PowerShell 和 CMD 无法直接执行 bash 脚本。

---

## Troubleshooting / 常见问题

### `sqlite3: command not found`

The `sqlite3` CLI is not on your PATH. Follow Step 3 above to install it, then restart your terminal.

> `sqlite3` CLI 不在 PATH 中。按上方第3步安装后重启终端。

### `./ss: Permission denied`

```bash
chmod +x ./ss
```

### `npm run build` fails with TypeScript errors

Ensure Node.js is 18 or higher:

```bash
node --version
```

If it shows v16 or lower, reinstall from [nodejs.org](https://nodejs.org/).

### `DEEPSEEK_API_KEY is not set`

Make sure you created `.env` from `.env.example` and filled in your key:

```bash
cp .env.example .env
# then edit .env with your key
```

### Long paths cause errors on Windows

Enable long path support in Windows:

```powershell
# Run as Administrator
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
  -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

---

## Verifying Your Setup / 验证安装

Run the built-in health check:

```bash
./ss doctor
```

If everything is green, you're ready. Start with:

```bash
./ss Alpha    # built-in guide persona — no creation needed
```
