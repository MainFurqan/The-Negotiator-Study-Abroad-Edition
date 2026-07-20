# Deployment (AWS)

The whole stack runs on **one EC2 instance** via Docker Compose: FastAPI backend, the Next.js
dashboard, and **Caddy** terminating HTTPS. Caddy fetches a real Let's Encrypt certificate for a free
`sslip.io` hostname (no domain to buy) and routes everything through **one origin** — so the
dashboard *and* the ElevenLabs tool webhooks share a single, permanent HTTPS URL. This replaces
ngrok for good.

```
                        ┌─────────────── EC2 (Ubuntu, Docker) ───────────────┐
Internet ── :443 ──►  Caddy  ──/api,/tools,/health──►  backend (uvicorn :8000) ──► SQLite volume
                        │      ──everything else──────►  frontend (next start :3000)
                        └─────────────────────────────────────────────────────┘
```

Files that define this: `deploy/docker-compose.yml`, `deploy/Caddyfile`, `backend/Dockerfile`,
`frontend/Dockerfile`.

> The UX restructure (gated flow bar, multi-student picker, the three-agency caller) needs **no infra
> changes**: it adds only routes under the already-proxied `/api/*` prefix and one additive
> `student_profile.active` column (auto-migrated on startup). The safety rule is unchanged — every
> real dial still goes to `VERIFIED_TARGET_NUMBER`. For a first-time end-to-end setup follow
> [SETUP-GUIDE.md](SETUP-GUIDE.md).

## URLs (one origin)

- `https://<ip>.sslip.io/` — dashboard (landing)
- `https://<ip>.sslip.io/intake` · `/board` · `/report`
- `https://<ip>.sslip.io/tools/*` — the agent webhooks
- `https://<ip>.sslip.io/api/*`, `/health`

`sslip.io` resolves `A-B-C-D.sslip.io` to IP `A.B.C.D` automatically, so IP `3.121.45.67` →
`3-121-45-67.sslip.io`. Bring your own domain by pointing an A record at the IP and using it as
`DOMAIN` instead.

## 1. Launch the instance

EC2 → Launch instance:
- **AMI** Ubuntu Server 24.04 LTS · **Type** `t3.small` (t2/t3.micro can OOM during the Next build)
- **Key pair** create + download the `.pem`
- **Security group** inbound: **22** (SSH, *My IP*), **80** and **443** (Anywhere)
- **Storage** 16 GB gp3

Then **Elastic IP → Allocate → Associate** with the instance so the IP (and therefore your URL and
the ElevenLabs webhook URLs) survives reboots.

## 2. Install Docker

```bash
ssh -i negotiator.pem ubuntu@<IP>
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && exit    # re-login to pick up the group
```

## 3. Ship code + secrets

```bash
ssh -i negotiator.pem ubuntu@<IP>
git clone <YOUR_REPO_URL> negotiator
```

From your **own** machine (never commit `.env`):

```bash
scp -i negotiator.pem .env ubuntu@<IP>:~/negotiator/.env
# optional: carry over an already-frozen profile + call history
scp -i negotiator.pem backend/negotiator.db ubuntu@<IP>:~/negotiator/seed.db
```

## 4. Start the stack

```bash
cd ~/negotiator/deploy
DOMAIN=<ip-with-dashes>.sslip.io docker compose up -d --build
```

First build takes a few minutes (Next build + reportlab). Then:

```bash
curl https://<ip-with-dashes>.sslip.io/health
# {"status":"ok","vertical":"uk-llb",...}
```

Load the optional seed DB once:

```bash
docker compose cp ../seed.db backend:/data/negotiator.db && docker compose restart backend
```

## 5. Point ElevenLabs at the permanent URL (one-time)

Replace any tunnel base with `https://<ip-with-dashes>.sslip.io` in every tool:
- Estimator → `save_profile`
- Caller → `log_quote`, `end_call_outcome`, `get_leverage`, `red_flag_check`

Publish both agents. Because the Elastic IP is fixed, you never touch these URLs again.

## Configuration details

### Environment & secrets
`.env` is mounted into the backend via `env_file` in the compose file — it never enters the image or
git. Keep it `chmod 600`. For a hardened setup, store secrets in **AWS SSM Parameter Store** or
**Secrets Manager** and render `.env` at boot, or switch `env_file` to individual `environment:`
entries populated from SSM.

### Database & persistence
SQLite lives on the named Docker volume `dbdata` mounted at `/data` (`NEGOTIATOR_DB=/data/negotiator.db`).
The FX cache persists alongside it (`NEGOTIATOR_FX_CACHE=/data/fx_cache.json`). The volume survives
`docker compose up --build`. **Back it up:**

```bash
docker compose cp backend:/data/negotiator.db ./backup-$(date +%F).db
```

### Reverse proxy & HTTPS
Caddy (`deploy/Caddyfile`) terminates TLS and routes `/api`, `/tools`, `/health` to the backend and
everything else to the frontend. Certificates are obtained and renewed automatically and stored in
the `caddydata` volume. Ports 80/443 must be open in the security group.

### Frontend build-time base URL
`frontend/Dockerfile` sets `NEXT_PUBLIC_API_BASE=""` before `npm run build`, so the app makes
**same-origin** relative requests (`/api/...`) that Caddy proxies. This is baked at build time — to
point the UI at a different backend origin, rebuild with a different value.

### Process management
`restart: unless-stopped` on every service means Docker restarts crashed containers and the whole
stack comes back on reboot (Docker's systemd unit is enabled by `get.docker.com`).

## Monitoring & logs

```bash
cd ~/negotiator/deploy
docker compose ps                 # container status
docker compose logs -f backend    # app logs
docker compose logs -f caddy      # TLS / routing
docker stats                      # live CPU/memory
```

`GET /health` is a lightweight liveness probe (wire it to an uptime monitor or a CloudWatch alarm via
a small cron + `aws cloudwatch put-metric-data`). For deeper metrics, install the CloudWatch agent on
the instance.

## Updating after a push

```bash
ssh -i negotiator.pem ubuntu@<IP>
cd negotiator && git pull
cd deploy && DOMAIN=<...>.sslip.io docker compose up -d --build
```

The `dbdata` volume (profile + calls) is untouched by rebuilds.

## Scaling & hardening notes

- **This is a single-box, single-writer design** (SQLite). It's ideal for the demo and light
  production. To scale out: put the backend behind an ALB, move storage to **RDS/Postgres** (swap the
  `sqlite3` calls in `db.py`) or mount SQLite on **EFS** for a single writer, and run the frontend on
  **CloudFront + S3/Amplify** or multiple backend tasks on **ECS Fargate**.
- **FX** already caches (6h TTL) so provider outages don't matter; no scaling concern.
- **Managed alternative:** frontend on Amplify/CloudFront, backend on App Runner or ECS Fargate,
  data on RDS + EFS, secrets in Secrets Manager. More moving parts and cost; the one-box setup is the
  fastest path to a live, permanent URL.

## Cost (rough)

- `t3.small` ≈ **$0.02/hr** (~$15/mo if left on) + a few GB gp3 storage (~$1–2/mo).
- Elastic IP is free while associated with a running instance; a small hourly fee applies while the
  instance is **stopped** — release the EIP if you're done.
- Stop the instance between demos to pay only for storage.

## Local dev is unchanged

Without `NEGOTIATOR_DB` / `ALLOWED_ORIGINS` / `NEXT_PUBLIC_API_BASE` set, everything behaves as in
[DEVELOPMENT.md](DEVELOPMENT.md): `localhost:8000` + `localhost:3000`, with a tunnel for webhooks.
