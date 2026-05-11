---
title: 'Optimizing My Eleventy Build: An AI Use Note'
display_title: 'Optimizing My Eleventy Build: An AI Use Note'
description: Using Claude at home, and finding that I don’t like the taste.
date: '2026-05-11T11:21:19.286-04:00'
tags:
  - AI
  - eleventy
  - programming
---

My Eleventy site has roughly 1200 pages, and for close to [two years](/posts/upgrading-eleventy-v3/) build times have hovered around 4 minutes, due to some expensive image transformations. Normally this isn’t a huge issue, but every time I publish a post I have a couple of quick fixes that follow, and waiting for builds to finish (or interrupting them on Netlify so I can push an update) gets a little bit nerve-wracking, especially if you have an embarrassing typo hanging out there in production.

tl;dr: I got the build time down to ~45 seconds.^[On Netlify. Local builds come in around ~20 seconds.] I did it with some help from Claude Code, which is the coding LLM of choice at work. Along the way I took some notes, because this turned out to be less about reducing your build times with ONE WEIRD TRICK and instead a way to think about why I find working with LLMs an odd fit when it comes to my personal work.

At work I have access to Claude and other LLMs, their use is broadly encouraged, and we have a fairly healthy dialogue around their limitations and risks. I’ve developed a loose taxonomy of situations where using them is helpful, as well as places where I actively avoid them. But that’s for another post. For now I’ll note some things that I find useful:

* Claude can examine a codebase and tell you how to use it, which is great for lightly (or terribly) documented code.
* Given a deep codebase with strong conventions/patterns it can create new code that aligns with your existing work
* You can make it build you a CLI to do a specific thing, so that you don’t have to burn tokens every time you do that thing

## A mental dividing line

All that said, I don’t use LLMs much outside of my day job. I write less hands-on code at work these days, so my personal work is a space to do things by hand and attempting to understand each piece. It’s slower — but for me, the [slowness is the point](https://www.instagram.com/p/DXaioGLAV5R/). 

![GIF of Tom Sizemore in Heat (1995), saying “For me, the action is the juice. I’m in.”](heat-the-action-is-the-juice.gif)

A slight digression: when I played hockey,^[In the lowest level of the Chelsea Piers adult rec league in New York.] I found that while the games were fun, I enjoyed team/solo practices more. Something about honing a very specific skill over and over appeals to my brain.

Anyway: the point. I had limped along with 4-minute builds for two years, and I was finally going to try and shave some of that time. I decided to experiment with using Claude, but in a decidedly obtuse fashion. The *fast* way to do this would be to point it at my repo, tell it to optimize the build, and let it go to work. I’ve used it enough to know that it would get there (or *somewhere* in the vicinity) pretty quickly. Me, though, I’m in it for the journey. So I used the conversational mode, feeding it some details around my build and seeing if it would eventually land on a good solution.

I also set an additional constraint: I would have to type every character of code it suggested, by hand. I find that just like taking handwritten notes, typing stuff instead of copying/pasting gives my brain a bit more time to absorb what the code is actually doing.

Even with those constraints, it ended up working out. Here’s the [full transcript](https://gist.github.com/dirtystylus/8503e2958a117f1787fe7ce7ed6069e3) in case you’re interested.

## Some details

My build was doing three layers of image transformation:

* Markdown to HTML 
* Eleventy Image transform to create srcset/sizes markup and Netlify CDN URLs
* A custom transform to add GLightbox support

Early on Claude suggested a couple of things:

* An image shortcode (I already had one, and moved away from it so I could keep my Markdown files as portable as possible)
* Adding conditionals on the custom transform (I had a few checks in there already, this seemed promising)
* Modifying the Markdown transformation (I didn’t explore this because of the risks of a regex-based approach)

The solution I eventually chose was to remove the Eleventy Image transform and have a single transform to do the srcset/sizes and GLightbox work. The downside was that Eleventy Image does width/height introspection, so skipping that transform would leave my images without width/height attributes and I would potentially have cumulative layout shift ([CLS](https://developer.mozilla.org/en-US/docs/Glossary/CLS)). It felt like a fair tradeoff, though: 45 seconds!

Here’s the current transform in my `.eleventy.config.js`. It:

* Checks if this is a page (output path ends with `.html`)
* Checks if there’s an image in the content
* Checks if this is a post (I guess I should see if I want this to extend to my book/film posts)
* Pulls attributes from the image to a wrapper `<a>` tag so that GLightbox can grab onto them
* If we’re running locally, doesn’t bother with srcset/sizes
* If we’re running on Netlify, output srcset/sizes markup, and make the image URLs use the Netlify CDN syntax

```js
const WIDTHS = [320, 960, 1400, 1920, 4000];
const SIZES = "(max-width: 45em) 640px, 100vm";

eleventyConfig.addTransform("prepareImages", function(content) {
	const pageOutputPath = this?.page?.outputPath;
	if (typeof pageOutputPath !== "string") return content;
	if (!this.page.outputPath?.endsWith(".html")) return content;
	if (!content.includes("<img")) return content;

	const data = pageDataMap.get(this.page.inputPath);
	if (data?.content_type !== "post") return content;

	const $ = cheerio.load(content);
	$("img").each((i, el) => {
		const imgSrc = $(el).attr("src");
		const imgGallery = $(el).attr("data-gallery");
		const classes = $(el).attr("class");

		let imgCaption = "";
		if (
			$(el).next().length > 0 &&
			$(el).next().prop("tagName").toLowerCase() === "figcaption"
		) {
			imgCaption = $(el).next().html();
		}

		if (process.env.ELEVENTY_RUN_MODE === "serve") {
			$(el).wrap("<a></a>");
			const parent = $(el).parent();
			if (classes) parent.addClass(classes);
			parent.addClass("glightbox");
			parent.attr("href", imgSrc);
		} else {
			// Build Netlify URLs
			const filePathStem = data.page.filePathStem;
			const filePathTrimmed = filePathStem.replace(/\/index$/, "");
			const imgUrl = `${filePathTrimmed}/${imgSrc}`;
			const cdnUrl = (w) => `/.netlify/images?url=${imgUrl}&w=${w}&fit=contain`;
			const srcset = WIDTHS.map(w => `${cdnUrl(w)} ${w}w`).join(", ");

			// Update img attributes
			$(el).attr("src", cdnUrl(WIDTHS[0]));
			$(el).attr("srcset", srcset);
			$(el).attr("sizes", SIZES);
			$(el).removeAttr("width");
			$(el).removeAttr("height");

			// Wrap with glightbox anchor
			$(el).wrap("<a></a>");
			const parent = $(el).parent();
			if (classes) parent.addClass(classes);
			parent.addClass("glightbox");
			parent.attr("href", cdnUrl(WIDTHS[WIDTHS.length - 1]));
			parent.attr("data-srcset", srcset);
			parent.attr("data-sizes", SIZES);
			if (imgGallery) parent.attr("data-gallery", imgGallery);
			if (imgCaption !== "") parent.attr("data-title", imgCaption);
		}
	});
	return $.html();
});
```


## Back and forth

Reading through the transcript, I notice a couple of things. Chiefly, there’s no magic. Claude *might* have have arrived at my preferred solution in one shot, but the fact that I had to go through a long back-and-forth (covering ground I had already considered) reinforces my view that the power of this tool is directly related to the person wielding it. My experience (both career-wise as well as the author of this codebase) was necessary to get the desired result.^[I have thoughts about LLMs and how they affect the pipeline for junior folks, but again: that’s a different post.] 

I see myself asking for clarification several times: *what is this code doing, and why*? This really speaks to my desire to retain authorship of this code, because it’s my personal site. The mistakes and tradeoffs are mine.

I note areas where I have to state my preferences: *co-locate my images with my Markdown files, remember I’m using Netlify to deploy this*. When using Claude at work a lot of these preferences end up in my `claude.md` file, and it sometimes gets long enough that I ask myself whether I should’ve just written the code myself.

## Choosing who you talk to

How did it feel, though? Multiple times I felt the sense of alienation that comes with this way of working. These tools are designed to make you turn to them first, before you ask someone else, or even come up with your own solution.^[Today I noticed that Claude now has streak data when you fire it up, which made me physically recoil.] I also realized something that’s taken a long time to put my finger on: I learn (and teach) via analogy, and Claude will not do this unless you ask it to.

The lesson for me isn’t to draw a hard line on LLM use for my personal work  — it’s that I should be having more of these conversations with friends. It would likely take longer, but I’d get to hear how another human thinks. I would probably hear some good jokes along the way. Humans are just more fun! I’m here for the story, the code is just a nice doggie bag to take home.