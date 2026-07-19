# Deploying to AWS (one EC2 box, shareable HTTPS link)

One EC2 instance runs the whole stack via Docker Compose: FastAPI backend, Next.js
dashboard, and Caddy terminating HTTPS on a free `sslip.io` hostname (no domain to buy —
`A-B-C-D.sslip.io` resolves to IP `A.B.C.D` automatically, and Caddy fetches a real
Let's Encrypt certificate for it).

Everything lives on ONE origin, so the same link serves the dashboard AND the ElevenLabs
tool webhooks — replacing ngrok permanently:

- `https://<ip>.sslip.io/`               profile intake dashboard
- `https://<ip>.sslip.io/board`          live quote board
- `https://<ip>.sslip.io/report`         ranked report
- `https://<ip>.sslip.io/architecture.html`  technical architecture page
- `https://<ip>.sslip.io/tools/*`        the 5 agent webhooks
- `https://<ip>.sslip.io/health`         health check

## 1. Launch the instance (AWS console)

1. EC2 → Launch instance:
   - Name: `negotiator` · AMI: **Ubuntu Server 24.04 LTS** · Type: **t3.small**
     (t2/t3.micro can OOM during the Next.js build).
   - Key pair: create one, download the `.pem`.
   - Security group — allow inbound: **22** (SSH, My IP), **80** and **443** (Anywhere).
   - Storage: 16 GB gp3.
2. (Recommended) Elastic IPs → Allocate → Associate with the instance, so the IP —
   and therefore your link and the ElevenLabs tool URLs — survives restarts.
3. Note the public IP. Your domain is `<ip with dashes>.sslip.io`,
   e.g. IP `3.121.45.67` → `3-121-45-67.sslip.io`.

## 2. Install Docker on the box

```bash
ssh -i negotiator.pem ubuntu@<IP>
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && exit   # re-login to pick up the group
```

## 3. Ship the code + secrets

```bash
ssh -i negotiator.pem ubuntu@<IP>
git clone <YOUR_REPO_URL> negotiator && cd negotiator
```

Then from your OWN machine (never commit `.env`):

```bash
scp -i negotiator.pem .env ubuntu@<IP>:~/negotiator/.env
# optional: carry over the already-frozen profile + call history
scp -i negotiator.pem backend/negotiator.db ubuntu@<IP>:~/negotiator/seed.db
```

## 4. Start the stack

```bash
cd ~/negotiator/deploy
DOMAIN=<ip-with-dashes>.sslip.io docker compose up -d --build
```

First build takes a few minutes. Then:

```bash
curl https://<ip-with-dashes>.sslip.io/health
# {"status":"ok","vertical":"uk-llb",...}
```

If you copied `seed.db`, load it into the data volume once:

```bash
cd ~/negotiator/deploy
docker compose cp ../seed.db backend:/data/negotiator.db
docker compose restart backend
```

## 5. Repoint ElevenLabs (5 tool URLs, one-time)

Replace the ngrok base with `https://<ip-with-dashes>.sslip.io` in:

- Estimator agent → `save_profile`
- Caller agent → `log_quote`, `end_call_outcome`, `get_leverage`, `red_flag_check`

Publish both agents. Done — no more ngrok, the URL never changes again
(as long as the Elastic IP stays associated).

## Updating after a git push

```bash
ssh -i negotiator.pem ubuntu@<IP>
cd negotiator && git pull
cd deploy && DOMAIN=<...>.sslip.io docker compose up -d --build
```

## Costs

t3.small ≈ $0.02/hour + a few GB of storage. Stop the instance when the hackathon is
over (Elastic IP incurs a small fee while the instance is stopped — release it if
you're done for good).

## Local dev is unchanged

Without `NEGOTIATOR_DB` / `ALLOWED_ORIGINS` / `NEXT_PUBLIC_API_BASE` set, everything
behaves exactly as before (localhost:8000 + localhost:3000 + ngrok).
