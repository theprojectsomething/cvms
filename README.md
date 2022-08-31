# A private document server for your CV

A simple, private document server, designed for sharing access to sensitive things with a group (like a CV with a prospective employer). Built in modern javascript. Intended for deployment to modern serverless environments.

## Features

- Stateless, serverless, simple.
- Zero javascript on the front-end, minimal dependencies otherwise
- Limit access to documents with passphrases and time-limits
- URLs structured for no-nonsense metrics
- Markdown-rendered pages and templates
- API access built-in
- deploys to Cloudflare Pages in <2mins
- file based, no databases or remote I/O
- HMAC-backed stateless authentication

**See it in action [@theprojectsomething.com →](https://thesom.au/cv)**

## Quick Start: to the Edge and back in <2mins
1. Clone the repo
```sh
git clone https://github.com/theprojectsomething/cv.git
cd cv
```
2. Create a private key for in-app auth (you might want to revisit this later)
```sh
node -e "console.log('VITE_AUTH_SECRET_KEY=\"'+crypto.randomBytes(16).toString('hex')+'\"')" > .env.local
```
3. Install and build the app
```sh
npm install
npm run build
```
4. Publish to the edge
```sh
# aliases: npx wrangler pages publish ./dist
npm run publish
```
5. Visit the published url and log into the default route with the passphrase `let me in`

---

*Further detail coming soon ...*

## Todo

- [] markdown components
- [] relative urls for components (per front-matter)
- [] component attributes
- [] placeholders for route info (e.g. passphrase, owner, description)
