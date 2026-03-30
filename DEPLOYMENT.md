<a id="english-guide"></a>
# Deployment Guide (Public Cloud Server)

This guide explains how to deploy the Class Visual Score System on a public cloud server.

## 1. Prepare Server Environment

OS example: Ubuntu 22.04 LTS.

1. Update packages:

```bash
sudo apt update && sudo apt upgrade -y
```

2. Install Node.js (LTS, recommend Node 22+):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

3. Install PM2 globally:

```bash
sudo npm install -g pm2
pm2 -v
```

## 2. Upload Project Code

### Option A: Git (Recommended)

1. Install Git:

```bash
sudo apt install -y git
```

2. Clone repository:

```bash
git clone <your-repo-url> class-score-system
cd class-score-system
```

3. Install dependencies:

```bash
npm install
```

### Option B: FTP/SFTP Upload

1. Compress your local project folder.
2. Upload to server by FTP/SFTP tools (e.g. FileZilla/WinSCP).
3. Extract on server and enter project directory.
4. Run:

```bash
npm install
```

## 3. Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

Recommended `.env` values:

```env
PORT=3000
ADMIN_PASSWORD=your_strong_password
DB_PATH=./server/data/class-score.db
```

## 4. Start App with PM2

```bash
pm2 start npm --name class-score -- start
pm2 status
pm2 logs class-score
```

Enable auto-start on reboot:

```bash
pm2 startup
pm2 save
```

## 5. Nginx Reverse Proxy (3000 -> 80/443)

1. Install Nginx:

```bash
sudo apt install -y nginx
```

2. Create site config:

```bash
sudo nano /etc/nginx/sites-available/class-score
```

Use this config (supports WebSocket):

```nginx
server {
    listen 80;
    server_name your_domain_or_ip;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

3. Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/class-score /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

4. (Optional) HTTPS with Let's Encrypt:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your_domain
```

## 6. Firewall (UFW) Security Suggestions

Allow only required ports:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

If your app must be accessed directly on 3000 for testing:

```bash
sudo ufw allow 3000/tcp
```

## 7. Update and Redeploy

### Git workflow

```bash
cd class-score-system
git pull
npm install
pm2 restart class-score
```

### FTP workflow

1. Upload changed files.
2. Run `npm install` if dependencies changed.
3. Restart process:

```bash
pm2 restart class-score
```

---

<a id="中文说明"></a>
# 部署说明（公网云服务器）

本文说明如何将班级可视化积分系统部署到公网服务器。

## 1. 服务器环境准备

系统示例：Ubuntu 22.04 LTS。

1. 更新系统包：

```bash
sudo apt update && sudo apt upgrade -y
```

2. 安装 Node.js（建议 22+）：

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

3. 安装 PM2：

```bash
sudo npm install -g pm2
pm2 -v
```

## 2. 上传代码

### 方式 A：Git（推荐）

1. 安装 Git：

```bash
sudo apt install -y git
```

2. 拉取仓库：

```bash
git clone <你的仓库地址> class-score-system
cd class-score-system
```

3. 安装依赖：

```bash
npm install
```

### 方式 B：FTP/SFTP 上传

1. 在本地打包项目。
2. 使用 FTP/SFTP 工具（FileZilla/WinSCP）上传到服务器。
3. 在服务器解压并进入项目目录。
4. 执行：

```bash
npm install
```

## 3. 配置环境变量

```bash
cp .env.example .env
nano .env
```

建议配置：

```env
PORT=3000
ADMIN_PASSWORD=请设置强密码
DB_PATH=./server/data/class-score.db
```

## 4. 使用 PM2 启动

```bash
pm2 start npm --name class-score -- start
pm2 status
pm2 logs class-score
```

设置开机自启：

```bash
pm2 startup
pm2 save
```

## 5. Nginx 反向代理（3000 转发到 80/443）

1. 安装 Nginx：

```bash
sudo apt install -y nginx
```

2. 新建站点配置：

```bash
sudo nano /etc/nginx/sites-available/class-score
```

配置示例（包含 WebSocket）：

```nginx
server {
    listen 80;
    server_name your_domain_or_ip;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

3. 启用并重载：

```bash
sudo ln -s /etc/nginx/sites-available/class-score /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

4. （可选）配置 HTTPS：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your_domain
```

## 6. 防火墙安全建议（UFW）

建议只开放必要端口：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

若需要临时直连 3000 调试：

```bash
sudo ufw allow 3000/tcp
```

## 7. 更新与重部署

### Git 更新方式

```bash
cd class-score-system
git pull
npm install
pm2 restart class-score
```

### FTP 更新方式

1. 上传变更文件。
2. 若依赖变化，执行 `npm install`。
3. 重启服务：

```bash
pm2 restart class-score
```
