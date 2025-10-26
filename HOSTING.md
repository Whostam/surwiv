# Host Survev.io for Friends and the Public

This guide turns the repository into a running public server using clear, numbered steps. You will:

1. Rent an inexpensive virtual private server (VPS).
2. Install the required software.
3. Download and configure Survev.io.
4. Publish the game through an NGINX reverse proxy.
5. Keep the services running automatically.

If you follow each step in order, you will end with a server anyone can join from their browser.

---

## 0. What you need before starting

| Item | Why it matters |
| --- | --- |
| Laptop or desktop with a terminal (Windows Terminal, macOS Terminal, or a Linux shell) | Needed to connect to the remote server. |
| Credit card or PayPal account | Required to rent the VPS. |
| Email address | Used for the VPS provider and (optionally) a domain registrar. |
| 60–90 minutes of focused time | The full setup is longer than a quick script. |

> **Tip:** Keep this guide open on your computer. You can copy and paste every command that appears in a `code block`.

---

## 1. Rent a virtual private server (VPS)

1. Visit [https://www.vultr.com](https://www.vultr.com) in your browser.
2. Create an account (use the "Sign up" button) and add a payment method. Vultr offers hourly billing; a $6/month "Regular Performance" instance is enough for a small public server.
3. After logging in, click **Deploy New Server → Cloud Compute**.
4. Choose a region near your players (for example, Chicago for North America or Frankfurt for Central Europe).
5. Select **Ubuntu 22.04 x64** as the operating system. This tutorial assumes Ubuntu, which is stable and well-supported.
6. Pick the **$6/month (1 vCPU / 1 GB RAM / 55 GB SSD)** plan. Larger plans work the same way.
7. Leave additional options at their defaults and click **Deploy Now**.

Vultr will provision the machine in about a minute. On the dashboard you will see:

- The server **IP address** (for example `203.0.113.10`).
- The **username** (`root`).
- A randomly generated **password**. Click the eye icon to reveal it.

Write these three values down—they are your keys to log in.

> **Prefer another host?** Any VPS provider works as long as it gives you full root access. Hetzner, Ionos, DigitalOcean, and Linode are popular alternatives. Choose a plan with at least 1 GB RAM.

---

## 2. Connect to the VPS with SSH

1. Open a terminal on your computer.
2. Run the command below, replacing `<ip-address>` with the IP from the Vultr dashboard:
   ```sh
   ssh root@<ip-address>
   ```
3. The first connection prints a warning that the host is unknown. Type `yes` and press **Enter**.
4. Paste the password from the dashboard (right-click paste works in most terminals) and press **Enter**. The cursor will not move while you type—this is normal.
5. When the prompt changes to `root@...`, you are inside the VPS.

If Vultr issued a custom SSH port, run `ssh root@<ip-address> -p <port>` instead.

---

## 3. Update Ubuntu and install core tools

All commands in this section run inside the SSH session.

1. Refresh the package index:
   ```sh
   apt update
   ```
2. Install sudo (it is missing on some fresh images):
   ```sh
   apt -y install sudo
   ```
3. Install Git and NGINX:
   ```sh
   sudo apt -y install git nginx
   ```
4. Install Node.js 20 using NodeSource’s official repository:
   ```sh
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt -y install nodejs
   ```
   > If you see a prompt asking to continue, type `y` and press **Enter**.
5. Install pnpm globally:
   ```sh
   sudo npm install -g pnpm
   ```
6. (Optional but recommended) Install PostgreSQL for accounts, leaderboards, and bans:
   ```sh
   sudo apt -y install postgresql
   sudo systemctl enable --now postgresql
   sudo -u postgres createuser survev
   sudo -u postgres createdb survev -O survev
   ```

At this point the tools Survev.io depends on are ready.

---

## 4. Download Survev.io and run the setup wizard

1. Move to the `/opt` directory (a common place for custom software) and clone the project:
   ```sh
   cd /opt
   sudo git clone https://github.com/leia-uwu/survev.git
   sudo chown -R root:root survev
   cd survev
   ```
2. Install the JavaScript dependencies (this takes a few minutes the first time):
   ```sh
   pnpm install
   ```
3. Launch the interactive setup. It creates `survev-config.hjson` with the values you provide:
   ```sh
   pnpm survev-setup
   ```
   - Choose **Production** mode when asked.
   - Enter a **public hostname** (use the VPS IP for now; you can add a domain later).
   - When prompted for the API/game secrets, keep the generated defaults unless you already have replacements.
   - If you installed PostgreSQL, answer **Yes** when the wizard asks about database support and supply `postgres://survev@localhost:5432/survev` as the connection string.
4. Build the client and server bundles:
   ```sh
   pnpm build
   ```

When the build finishes, the project is ready to serve traffic.

---

## 5. Configure NGINX to serve the game

NGINX forwards browser requests to the Survev.io API and game server. These commands set it up.

1. Give NGINX permission to read the built client files:
   ```sh
   sudo chown -R www-data:www-data /opt/survev/client/dist
   ```
2. Remove the default site:
   ```sh
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo rm -f /etc/nginx/sites-available/default
   ```
3. Create a new configuration file:
   ```sh
   sudo tee /etc/nginx/sites-available/survev.conf >/dev/null <<'NGINX'
   server {
       listen 80;
       listen [::]:80;
       server_name _;

       # Serve the built client
       root /opt/survev/client/dist;

       location / {
           try_files $uri $uri/ /index.html;
       }

       # Forward API requests
       location /api {
           proxy_http_version 1.1;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_pass http://127.0.0.1:8000;
       }

       # Forward private admin endpoints
       location /private {
           proxy_http_version 1.1;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_pass http://127.0.0.1:8000;
       }

       # Forward the matchmaking WebSocket
       location /team_v2 {
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "Upgrade";
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_pass http://127.0.0.1:8000;
       }
   }
   NGINX
   ```
4. Enable the new site and restart NGINX:
   ```sh
   sudo ln -s /etc/nginx/sites-available/survev.conf /etc/nginx/sites-enabled/survev.conf
   sudo systemctl restart nginx
   ```

Visit `http://<ip-address>` in your browser. You should see the Survev.io loading screen (errors are normal until the services start in the next step).

---

## 6. Keep the API and game server running

Create systemd units so the services start automatically at boot.

1. Game server unit:
   ```sh
   sudo tee /etc/systemd/system/survev-game.service >/dev/null <<'UNIT'
   [Unit]
   Description=Survev.io game server
   After=network.target

   [Service]
   Type=simple
   WorkingDirectory=/opt/survev/server
   ExecStart=/usr/bin/pnpm start:game
   Restart=always

   [Install]
   WantedBy=multi-user.target
   UNIT
   ```
2. API server unit (skip if you only run the game server):
   ```sh
   sudo tee /etc/systemd/system/survev-api.service >/dev/null <<'UNIT'
   [Unit]
   Description=Survev.io API server
   After=network.target

   [Service]
   Type=simple
   WorkingDirectory=/opt/survev/server
   ExecStart=/usr/bin/pnpm start:api
   Restart=always

   [Install]
   WantedBy=multi-user.target
   UNIT
   ```
3. Enable and start the services:
   ```sh
   sudo systemctl enable --now survev-game
   sudo systemctl enable --now survev-api
   ```
4. Check their status (both should show `active (running)`):
   ```sh
   systemctl status survev-game
   systemctl status survev-api
   ```
   Use `q` to exit the status view.

Now refresh `http://<ip-address>` in your browser. Create a lobby and confirm that gameplay loads without errors.

---

## 7. Optional polish

- **Add HTTPS:** Point a domain name at the VPS IP, then use [Let’s Encrypt](https://certbot.eff.org/) to request a free TLS certificate (`sudo certbot --nginx`).
- **Run the Discord bot:** Repeat the systemd process for `/opt/survev/bot` if you want automated moderation helpers.
- **Back up your config:** Copy `/opt/survev/survev-config.hjson` somewhere safe. It contains your secrets and region list.
- **Update the server:** Periodically run `sudo apt update && sudo apt upgrade -y` and `git pull && pnpm install && pnpm build` inside `/opt/survev` to stay current.

---

## 8. Troubleshooting checklist

| Symptom | Quick fix |
| --- | --- |
| Browser shows “connection refused” | Run `sudo systemctl status nginx` to ensure NGINX is running. |
| Lobby opens but matchmaking hangs | Confirm `survev-game` is `active` and the firewall allows inbound TCP ports 80 and 443. |
| Setup wizard cannot reach PostgreSQL | Make sure you ran `sudo systemctl enable --now postgresql` and used the connection string `postgres://survev@localhost:5432/survev`. |
| Changes do not appear after `git pull` | Run `pnpm build` again and restart both systemd services. |

When in doubt, rerun the commands in the relevant step. They are idempotent and safe to repeat.

---

Congratulations! Your Survev.io instance is live. Share the IP or domain with friends and start hosting matches.
