# nginx configs for originfacts.com

Snapshot of the nginx vhost serving https://www.originfacts.com from the
self-hosted dedicated VM (origin IP `146.0.42.20`).

## Files

- `originfacts.com.conf` — production vhost. Two `server` blocks:
  - port 443 (TLS) serving both `originfacts.com` and `www.originfacts.com`,
    bare host 301'd to the `www` canonical, certbot-managed Let's Encrypt cert.
  - port 80 catch-all 301'ing to HTTPS (also certbot-managed).

  Proxies to `127.0.0.1:3000` (the native `originfacts-com.service` systemd
  service running `next start`).

## Deploying changes

```bash
sudo cp ops/nginx/originfacts.com.conf /etc/nginx/sites-available/originfacts.com
sudo nginx -t                  # syntax check
sudo systemctl reload nginx    # zero-downtime reload
```

## Cert renewal

Automatic via the system `certbot.timer` (Let's Encrypt 90-day certs renew
~30 days before expiry). To force a renewal:

```bash
sudo certbot renew --cert-name originfacts.com
```

## First-time bring-up (history)

1. `/etc/nginx/sites-available/originfacts.com` created with port 80 only.
2. DNS A records pointed `originfacts.com` and `www.originfacts.com` at
   `146.0.42.20`.
3. `certbot --nginx -d originfacts.com -d www.originfacts.com --redirect`
   issued the cert and rewrote the file to add the HTTPS server block and
   HTTP→HTTPS redirect (the file you see committed here is the
   post-certbot state).
