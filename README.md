# C✌️MS

**A simple, private website for your curriculum vitae**

Designed for securing and sharing sensitive documents, links and downloads with small groups of people. Built in modern javascript. Intended for deployment to a serverless environment.

## Stateless, serverless, simple.

- [x] file based - no databases or remote I/O
- [x] zero javascript on the front-end, minimal dependencies otherwise
- [x] limit access to documents with passphrases and time-limits
- [x] URLs structured for no-nonsense metrics
- [x] markdown-rendered pages and templates
- [x] API access built-in
- [x] deploys to Cloudflare Pages in <2mins
- [x] HMAC-backed stateless authentication

**See it in action: [@theprojectsomething.com](https://thesom.au/cvms)** *← use the passphrase "let me in"* 

## 🤖 Quick Start: life on the Edge in <2mins

**CVMS** is currently optimised for deployment to Cloudflare Pages - designed to play very nicely at the low-end of the generous free tier. To deploy the site per the example below you'll need a Cloudflare account (also free).

1. Clone the repo
```sh
git clone https://github.com/theprojectsomething/cv.git
cd cv
```
2. Create a private key for in-app auth (you might want to revisit this later)
```sh
node -e "console.log('VITE_AUTH_SECRET_KEY=\"'+crypto.randomBytes(16).toString('hex')+'\"')" > .env.local
```
3. Install the app
```sh
npm install
```
4. Publish to the edge [^ahem]
```sh
npm run publish
```
5. Visit the published url and log in with the passphrase `let me in`

[^ahem]: **A note for the wary:** For those who live life far from the edge, or who simply prefer to test things locally before publishing to the world-wide-web, use `npm run dev` in place of step 4. ¯\\_ (ツ)_/¯

---

## 👻 Basic analytics

You can enable basic, domain-scoped analytics for your application by following the instructions in `env.local.example` to include the relevant information.

To view your admin-only analytics dashboard, first update the passphrase in `routes/analytics/auth.json` (the default value is "analytics") and then re-deploy the application. Once deployed, enter your updated passphrase on the homepage. Analytics metrics will begin populating soon after deployment.

*Further detail coming soon ...*

## Still to do ...

- [x] basic analytics for routes (CF GraphQL API)
- [x] admin route to view stats
- [ ] markdown components
- [ ] relative urls for components (per front-matter)
- [ ] component attributes
- [ ] placeholders for route info (e.g. passphrase, owner, description)
- [ ] live editing: edit routes / markdown (GH API)
