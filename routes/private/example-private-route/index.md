---
title: Example Private Route
date: 2022-08-25 
headings:
  - Welcome!
  - Templates
  - Private routes
  - Special routes
links:
  - ~/shared/
  - ~/hello
  - https://commonmark.org/
  - https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax
---

# Example Private Route

## Welcome!

This page is rendered as HTML from a [markdown-formatted](https://commonmark.org/) text file. Markdown allows you to quickly layout a page without any fuss, including things like:
- formatting text with *italics*, **bold** or ~~strikethrough~~
- [external links](hello) and [internal ones](#welcome)
- lists (like this one)
   1. and numbered
     - or sub lists like this one
- **headings (like above)** and paragraphs (like below)
- plus [much more](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)

### Templates

Simple markdown documents are turned into 'stylish' HTML pages using **template.html** files, that live alongside them in the document structure. Each markdown document in the project is essentially a page on the website. For an example, take a look at the [markdown behind this page](index.md).

<style>
/* this is css embedded in our markdown! */
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

### Private routes

Routes are just a fancy name for the folders containing your documents, but how you structure these folders is key to how access is given. Excusing some [useful exceptions](#special-routes), every file on the server is by default *private and secure*.

To give someone access to a route, you first share a **passphrase**. This is entered into the homepage to authorise access and reveal the route to your document. You can create as many routes as you like, each with its own unique passphrase.

### Special routes

In addition to private routes there are also two *special routes* that live in their own folders:
1. The **public** route sits at [/public/](/public/) and contains files that can be accessed directly, without a passphrase
2. The **shared** route is not public, but is accessible to anyone with a passphrase for *any route*. Files that sit under the shared route are accessible via an "alias" attached to the active route. For example, if you have the passphrase for **example-private-route** you would access shared files under [/example-private-route/{name}/shared/](shared/). Fun times.

---

And there's lots more features.

*Good luck!*