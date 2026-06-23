# Server deploy (Linux)

One-shot deploy: pull `dev`, backend on **8000** (systemd), frontend on **3000** (PM2).

Repo: [abdulhadizaeem/Mitchells-fruit-limited](https://github.com/abdulhadizaeem/Mitchells-fruit-limited.git)

## Prerequisites (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y git python3 python3-venv python3-pip nodejs npm
sudo npm install -g pm2
```

## Env files (you add these)

```bash
# Backend
sudo nano /opt/mitchells-fruit-limited/backend/.env

# Frontend (rebuild after changing VITE_BASE_URL)
sudo nano /opt/mitchells-fruit-limited/frontend/.env
# Example:
# VITE_BASE_URL=http://YOUR_SERVER_IP:8000/api

# frontend/.env is not stored in git. Deploy backs it up to
# .deploy-env-backup/ before each git sync and restores it after.
# Or pass on deploy: sudo VITE_BASE_URL=http://YOUR_IP:8000/api ./deploy/deploy.sh
```

## First deploy

```bash
git clone --branch dev https://github.com/abdulhadizaeem/Mitchells-fruit-limited.git /opt/mitchells-fruit-limited
cd /opt/mitchells-fruit-limited
chmod +x deploy/deploy.sh
sudo ./deploy/deploy.sh
```

## Updates (pull dev and restart)

```bash
sudo /opt/mitchells-fruit-limited/deploy/deploy.sh
```

## Git "dubious ownership"

After deploy, the repo is owned by `www-data`. Use the deploy script to update, or pull as root:

```bash
sudo git config --global --add safe.directory /opt/mitchells-fruit-limited
sudo git -C /opt/mitchells-fruit-limited pull origin dev
sudo chown -R www-data:www-data /opt/mitchells-fruit-limited
```

Do not run `git config --global` as your normal user for system paths unless you intend to.

## npm EACCES on `/var/www`

`www-data` often cannot write to `/var/www`. The deploy script now uses:

- `HOME` → app directory (default `/opt/mitchells-fruit-limited`)
- npm cache → `$APP_DIR/.npm-cache`
- PM2 home → `$APP_DIR/.pm2`

If you hit this before updating the script, run once:

```bash
sudo mkdir -p /opt/mitchells-fruit-limited/.npm-cache /opt/mitchells-fruit-limited/.pm2
sudo chown -R www-data:www-data /opt/mitchells-fruit-limited
sudo -u www-data env HOME=/opt/mitchells-fruit-limited NPM_CONFIG_CACHE=/opt/mitchells-fruit-limited/.npm-cache bash -c 'cd /opt/mitchells-fruit-limited/frontend && npm ci && npm run build'
```

## Useful commands

```bash
# Backend
sudo systemctl status mitchells-backend
sudo journalctl -u mitchells-backend -f
sudo systemctl restart mitchells-backend

# Frontend
sudo -u www-data pm2 status
sudo -u www-data pm2 logs mitchells-frontend
sudo -u www-data pm2 restart mitchells-frontend
```

## Customize paths / ports

```bash
sudo APP_DIR=/var/www/mitchells BACKEND_PORT=8000 FRONTEND_PORT=3000 APP_USER=deploy ./deploy/deploy.sh
```

If you change `APP_DIR`, edit `cwd` in `deploy/ecosystem.config.cjs` to match.
