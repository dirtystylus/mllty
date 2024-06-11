---
title: Upgrading to Eleventy 3.0
display_title: Upgrading to Eleventy 3.0
description: Netlify Large Media forces my hand.
date: '2024-06-11T10:26:17.308-04:00'
tags:
  - eleventy
  - web-development
---

## Large Media, Large Problems

One month ago my website stopped accepting commits due to an issue with Netlify Large Media. Netlify Large Media has been [deprecated](https://docs.netlify.com/git/large-media/setup/) for a while now, but Netlify had kept it working for sites that already had it installed, and I had no issues until it stopped working. Here’s [the thread](https://answers.netlify.com/t/netlify-large-media-error-repository-or-object-not-found/117974) where Netlify support tried to figure out what was wrong. We never did get to the bottom of things—it didn’t seem to be the obvious culprit (the Git credential helper) and while they were attempting to diagnose the issue I decided to see whether I could quickly rebuild my site in the latest version of Eleventy.

## On to Eleventy V3

Eleventy v3 is currently in alpha, but it felt stable enough to give it a shot.^[I was probably still high off the 11ty Conference vibes.] I ended up using the v9 branch of [Eleventy Base Blog](https://github.com/11ty/eleventy-base-blog/tree/v9). Here’s some of the things I noted moving my site from v1.

## Markdown wrangling

I typically add a filter for rendering Markdown in templates, like this:

```js
eleventyConfig.addFilter("markdown", function (data) {
	return mdLib.renderInline(data);
});
```

Which worked in *some* situations, but not all. I found that in some of my templates I had to use a paired shortcode instead:

```js
eleventyConfig.addPairedShortcode(
	"markdown",
	(data) => {
		if (data) {
			return mdLib.renderInline(data);
		} else {
			return "";
		}
	}
);
```

For example, in my **`post.njk`** template this did not work:

{% raw %}
```twig
<h1>{{ display_title or title | markdown }}</h1>
```
{% endraw%}

But this did:

{% raw %}
```twig
<h1>{% markdown %}{{ display_title or title }}{% endmarkdown %}</h1>
```
{% endraw%}

## Image Handling

Eleventy v3’s image plugin can be used in a number of related ways to optimize your images into different formats/sizes. The two that I ended up using were:

* [Eleventy Transform](https://www.11ty.dev/docs/plugins/image/#eleventy-transform), where Eleventy will transform any images referenced in HTML files in your site output folder
* [Asynchronous Shortcode](https://www.11ty.dev/docs/plugins/image/#nunjucks-liquid-javascript-(asynchronous-shortcodes)), where you explicitly pass a path to your image as well as attributes like alt text

The Eleventy Transform method is especially handy if you write your posts in Markdown and don’t want to mix in shortcodes for your images.

For context, I use two markdown-it plugins that affect my image markup: 

* [markdown-it-image-figures](https://github.com/Antonio-Laguna/markdown-it-image-figures)
* [markdown-it-attrs](https://github.com/arve0/markdown-it-attrs)

I used the shortcode for things like my reading/film logs, where I have the image path coming from the post’s YAML front matter and I need to render it in the template file. From my **`book.njk`** template:

{% raw %}
```twig
<div class="book-cover book-shadow">
    {% image cover_image, "Cover art for"+title %}
</div>
```
{% endraw %}

I was getting weird double processing of the images when I set it up like the [documentation has it](https://www.11ty.dev/docs/plugins/image/#nunjucks-liquid-javascript-(asynchronous-shortcodes)), so my image shortcode actually just returns an `<img>` tag:

```js
eleventyConfig.addShortcode("image", async function (src, alt, sizes) {
	return `<img src="${src}" alt="${alt}" />`;
});
```

### Using Netlify CDN

One of the ways you can use the Image plugin is to have it generate image derivatives in different formats and sizes. Since I am still deploying to Netlify and they have an [image CDN](https://docs.netlify.com/image-cdn/overview/), I check whether I’m running `eleventy --serve`, in which case I’m testing locally and I *don’t* want to transform the URLs for Netlify’s CDN. If I’m running a production build it returns a Netlify CDN URL format (for ex.: `/.netlify/images?url=/posts/philippines-japan-2023-part-2/phl-jpn-elnido-2.jpg?w=320&fit=contain`). YMMV, of course—if you’re deploying somewhere else I think letting the plugin pump out different image derivatives is probably the simplest approach, in which case you might not need to mess with the `urlFormat` options in the transform settings.

```js/35
let imgTransformSettings = {};
	if (process.env.ELEVENTY_RUN_MODE === 'serve') {
		imgTransformSettings = {
			extensions: "html",
			// Output formats for each image.
			formats: ["auto"],
			widths: [320,640,960,1280,1920],
			transformOnRequest: false,
			urlFormat: function ({
				hash, // not included for `statsOnly` images
				src,
				width,
				format,
			}) {
				return src.replace("content", "");
			},
			defaultAttributes: {
				loading: "lazy",
				decoding: "async",
				sizes: '(min-width: 45em) 640px,(min-width: 60em) 960px,100vw'
			},
		}
	} else {
		imgTransformSettings = {
			extensions: "html",
			// Output formats for each image.
			formats: ["auto"],
			widths: [320,640,960,1280,1920],
			transformOnRequest: false,
			urlFormat: function ({
				hash, // not included for `statsOnly` images
				src,
				width,
				format,
			}) {
				return `/.netlify/images?url=${src.replace("content","")}?w=${width}&fit=contain`;
			},

			defaultAttributes: {
				loading: "lazy",
				decoding: "async",
				sizes: '(min-width: 45em) 640px,(min-width: 60em) 960px,100vw'
			},
		}
	}

// Image optimization: https://www.11ty.dev/docs/plugins/image/#eleventy-transform
eleventyConfig.addPlugin(eleventyImageTransformPlugin, imgTransformSettings);
```

You might also notice I’m stripping out the string `content` from my image `src`—for some reason it was maintaining the source directory path instead of the deploy directory. So instead of:

```html
/posts/mawn/mawn-4.jpg
```

I was getting:

```html
/content/posts/mawn/mawn-4.jpg
```

This feels like it might be a bug, or an issue with how I’m designating passthrough for images.

## Image Gallery Changes

I previously had galleries handled using [a combination of Nicolas Hoizey’s Images Responsiver plugin and Photoswipe](/posts/eleventy-building-image-gallery-photoswipe/). [Images Responsiver](https://github.com/nhoizey/eleventy-plugin-images-responsiver/) hasn’t been updated for Eleventy v3, so I decided to simplify things and use [markdown-it-attrs](https://github.com/arve0/markdown-it-attrs) to apply specific classes to my images.

Photoswipe required me to set aspect ratios for all my gallery images, which led to some headaches with Markdown attributes, so I went looking for a replacement. I settled on [GLightbox](https://biati-digital.github.io/glightbox/). GLightbox will create a gallery from any images with the class `glightbox`, so I used markdown-it-attrs to do that. I add the class I want in curly brackets after the default Markdown image syntax: `{.glightbox}`.


{% raw %}
```twig
{% gallery %}

- ![A tricycle emblazoned with the slogan “God Will Make a Way 2” on the windshield.](phl-jpn-elnido-1.jpg "My mom and I had a good laugh about this one: what happened to God Will Make a Way 1?"){.glightbox}
- ![A man and a woman in sunglasses and hats, on a boat, smile with islands in the distance.](phl-jpn-elnido-3.jpg "Mom and Dad on the way to the Big Lagoon"){.glightbox}
…
{% endgallery %}

```
{% endraw %}

What’s tricky here is the order in which Markdown is converting image syntax to HTML, which is then transformed by Eleventy. The Markdown processing for a list of images left me with an `<img>` tag next to a `<figcaption>` tag (if there was a caption), but no wrapping `<figure>` tag around both. So within my `gallery` shortcode I had to write a pretty messy loop to create a `<figure>` wrapper element and move some attributes from the `<img>` tag to that. I used [Cheerio](https://cheerio.js.org) for the DOM manipulation:

```js
eleventyConfig.addPairedShortcode(
	"gallery", function (data) {
		const galleryContent = mdLib.render(data);
		const $ = cheerio.load(galleryContent);
		const dirPath = this.page.filePathStem.slice(0, this.page.filePathStem.length-5);
		$('img').each((i, el) => {
			const imgUrl = $(el).attr('src');
			const imgGallery = $(el).attr('data-gallery');
			let imgCaption = "";
			if ($(el).next().length > 0 && $(el).next().prop("tagName").toLowerCase() == 'figcaption') {
				imgCaption = $(el).next().html();
				$(el).next().addClass("visually-hidden");
			}
			$(el).wrap('<a></a>');
			const parent = $(el).parent();
			if (process.env.ELEVENTY_RUN_MODE === 'serve') {
				parent.attr("href", imgUrl);
			}
			else {
				parent.attr("href", `/.netlify/images?url=${dirPath}${imgUrl}?fit=contain`);
			}
			if (imgGallery) {
				parent.attr("data-gallery", imgGallery);
			}
			if (imgCaption !== "") {
				parent.attr("data-title", imgCaption);
			}

			$(parent).parent().wrapInner("<figure></figure>");
		});
		return `<div class="gallery">${$.html()}</div>`;
	}
);
```

This all feels pretty clunky but the end result works fairly well. If you have multiple galleries you can set a `data-gallery` attribute on a set of images and it will treat them as a distinct set. For example:

{% raw %}
```twig
{% gallery %}

- ![A tricycle emblazoned with the slogan “God Will Make a Way 2” on the windshield.](phl-jpn-elnido-1.jpg "My mom and I had a good laugh about this one: what happened to God Will Make a Way 1?"){.glightbox data-gallery=gallery1}
- ![A man and a woman in sunglasses and hats, on a boat, smile with islands in the distance.](phl-jpn-elnido-3.jpg "Mom and Dad on the way to the Big Lagoon"){.glightbox data-gallery=gallery1}
…
{% endgallery %}
```
{% endraw %}

## Images in my RSS feeds

In my Eleventy v1 build I added images for my reading/film log posts, pulled from the post front matter:

{% raw %}
```twig
{% if post.data.content_type == "book" %}
{% set book_metadata %}<p>{% image metadata.feed_reading.img_base_url + post.data.cover_image, post.data.title + " cover image" , "book_thumb" %}</p><p>Started Reading: {{post.data.start_date | readableDate }}</p><p>Finished Reading: {{post.data.end_date | readableDate }}</p>{% endset %}
<content type="html">{{book_metadata | htmlToAbsoluteUrls(absolutePostUrl)}}{{ post.templateContent | htmlToAbsoluteUrls(absolutePostUrl) }}</content>
{% elif post.data.content_type == "film" %}
{% set film_metadata %}<p>{% image metadata.feed_reading.img_base_url + post.data.cover_image, post.data.title + " cover image" , "book_thumb" %}</p><p>Watched: {{post.data.watched_date | readableDate }}</p>{% endset %}
<content type="html">{{film_metadata | htmlToAbsoluteUrls(absolutePostUrl)}}{{ post.templateContent | htmlToAbsoluteUrls(absolutePostUrl) }}</content>
{% else %}
<content type="html">{{ post.templateContent | htmlToAbsoluteUrls(absolutePostUrl) }}</content>
{% endif %}
```
{% endraw %}

When I tried to do this in v3 I got a `Tried to use templateContent too early on` error, but this [might be solved by v3.0.0-alpha.11](https://github.com/11ty/eleventy/issues/3294)

## Parting Thoughts

In general: I like the direction of Eleventy v3, and I think the new Image plugin is going to be very helpful for users (even if it does require some care when dealing with Markdown image syntax as well as CDN urls). I want to do a proper rebuild when v3 hits an official release, but for now this emergency rebuild went fairly well.

My site repo is [public](https://github.com/dirtystylus/mllty) in case anyone wants to check out the code.
