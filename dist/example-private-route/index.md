---
title: Example Private Route
date: 2022-08-25 
headings:
  - Welcome!
  - Templates
  - Routes
links:
  - ~/shared/
  - ~/shared/hello
  - https://commonmark.org/
  - https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax
---

# Example Private Route

## Welcome!

This page is rendered as HTML from a [markdown-formatted](https://commonmark.org/) text file. Markdown allows you to quickly layout a page without any fuss, including things like:
- formatted text including *italics*, **bold**, ~~strikethrough~~ or _**~~combinations~~**_
- [external links](shared/hello) and [internal ones](#welcome)
- lists (like this one)
- headings (like above) and paragraphs (like below)
- and [much more](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)

### Templates

The markdown file is rendered into a HTML page using a template - a file named **template.html** that lives in the same folder (or a parent). Each markdown file is essentially a page. You can take a look at **routes/example-private-route/index.md** to understand how this page was put together.

<style>
#welcome:target {
  outline: none;
}
#welcome:target::before {
  content: '';
  display: inline-block;
  width: 5em;
  position: absolute;
  height: 1em;
  z-index: -1;
  outline:  1px auto;
}
</style>

### Routes

Every file that sits under a given route (including all files and the page you are currently looking at) are private and cannot be accessed without a passphrase. In fact the route itself is secret. To give someone access, the only thing you need to share is the passphrase. You can create as many routes as you like, but keep in mind that each needs a unique passphrase.

There are also two *special routes / folders*: **public** which is public - anyone can access it without a passphrase; and **shared** which is not public, but is accessible to anyone with a passphrase for any route. Any files that sit under the **shared** route are accessible via an "alias" on the current route. For example, if you are signed into **example-private-route** you can access shared files  under **cv/example-private-route/{name}/shared/**, like [this one](/cv/example-private-route/anon/shared/). Fun times.

*Good luck!*