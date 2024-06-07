import { DateTime } from "luxon";
import markdownItAnchor from "markdown-it-anchor";
import markdownItAttrs from 'markdown-it-attrs';
import markdownItFootnote from 'markdown-it-footnote';
import markdownItImageFigures from 'markdown-it-image-figures';
import markdownIt from 'markdown-it';

import { InputPathToUrlTransformPlugin, HtmlBasePlugin } from "@11ty/eleventy";
import pluginRss from "@11ty/eleventy-plugin-rss";
import pluginSyntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import pluginNavigation from "@11ty/eleventy-navigation";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import Image from "@11ty/eleventy-img";
import path from "path";

import pluginFilters from "./_config/filters.js";

import * as cheerio from 'cheerio';

import debug from "debug";
const dbg = debug("mllty");


/** @param {import("@11ty/eleventy").UserConfig} eleventyConfig */
export default async function(eleventyConfig) {
	// Copy the contents of the `public` folder to the output folder
	// For example, `./public/css/` ends up in `_site/css/`
	eleventyConfig
		.addPassthroughCopy({
			"./public/": "/"
		})
		.addPassthroughCopy("./content/feed/pretty-atom-feed.xsl")
		.addPassthroughCopy("content/posts/**/*.jpg")
		.addPassthroughCopy("content/posts/**/*.png")
		.addPassthroughCopy("content/posts/**/*.gif")
		.addPassthroughCopy("content/posts/**/*.jpeg")
		.addPassthroughCopy("content/posts/**/*.mp4")
		.addPassthroughCopy("content/watching/**/*.jpg")
		.addPassthroughCopy("content/reading/**/*.jpg")
		.addPassthroughCopy("content/work/**/*.pdf");

	// Run Eleventy when these files change:
	// https://www.11ty.dev/docs/watch-serve/#add-your-own-watch-targets

	// Watch content images for the image pipeline.
	eleventyConfig.addWatchTarget("content/**/*.{svg,webp,png,jpeg}");

	// Per-page bundles, see https://github.com/11ty/eleventy-plugin-bundle
	// Adds the {% css %} paired shortcode
	eleventyConfig.addBundle("css");
	// Do you want a {% js %} bundle shortcode too?
	// eleventyConfig.addBundle("js");

	// Collections
	function makeDateFormatter(dateFormat) {
		return function (date) {
			// return moment(date).format(datePattern);
			return DateTime.fromJSDate(date, { zone: "utc" }).toFormat(dateFormat);
		};
	}

	function generateItemsDateSet(items, dateFormatter) {
		const formattedDates = items.map((item) => {
			return dateFormatter(item.data.page.date);
		});
		return [...new Set(formattedDates)];
	}

	function getItemsByDate(items, date, dateFormatter) {
		return items.filter((item) => {
			return dateFormatter(item.data.page.date) === date;
		});
	}

	const contentByDateString = (items, dateFormatter) => {
		return generateItemsDateSet(items, dateFormatter).reduce(function (
			collected,
			formattedDate
		) {
			return Object.assign({}, collected, {
				// lowercase to match month directory page.url
				[formattedDate.toLowerCase()]: getItemsByDate(
					items,
					formattedDate,
					dateFormatter
				),
			});
		},
		{});
	};

	const contentsByYear = (collection) => {
		return contentByDateString(collection, makeDateFormatter('yyyy'));
	};

	eleventyConfig.addCollection("sortedTags", function (collection) {
		let tagSet = new Set();
		collection
			.getAllSorted()
			.filter(function (item) {
				return item.data.content_type == "post";
			})
			.forEach(function (item) {
				if ("tags" in item.data) {
					let tags = item.data.tags;
					if (typeof tags === "string") {
						tags = [tags];
					}

					tags = tags.filter(function (item) {
						switch (item) {
							// this list should match the `filter` list in tags.njk
							case "all":
							case "nav":
							case "post":
							case "posts":
								return false;
						}

						return true;
					});

					for (const tag of tags) {
						tagSet.add(tag);
					}
				}
			});

		// returning an array in addCollection works in Eleventy 0.5.3
		return [...tagSet].sort();
	});

	eleventyConfig.addCollection("posts", function (collection) {
		const coll = collection
			.getAll()
			.filter(function (item) {
				return item.data.content_type == "post";
			})
			.sort(function (a, b) {
				return a.date - b.date;
			});

		return [...coll].reverse();
	});

	eleventyConfig.addCollection("books", function (collection) {
		const books = collection
			.getAll()
			.filter(function (item) {
				return item.data.content_type == "book";
			})
			.sort(function (a, b) {
					return a.date - b.date;
				});
		return [...books].reverse();
	});

	eleventyConfig.addCollection("films", function (collection) {
		const films = collection
			.getAll()
			.filter(function (item) {
				return item.data.content_type == "film";
			})
			.sort(function (a, b) {
					return a.date - b.date;
				});
		return [...films].reverse();
	});

	// Collections by Year

	eleventyConfig.addCollection("postsByYear", function (collection) {
		const coll = collection
			.getAll()
			.filter(function (item) {
				return item.data.content_type == "post";
			})
			.sort(function (a, b) {
				return a.date - b.date;
			});
		return contentsByYear(coll);
	});

	eleventyConfig.addCollection("booksByYear", function (collection) {
		const coll = collection
			.getAll()
			.filter(function (item) {
				return item.data.content_type == "book";
			})
			.sort(function (a, b) {
				return a.date - b.date;
			});

		return contentsByYear(coll);
	});

	eleventyConfig.addCollection("filmsByYear", function (collection) {
		const coll = collection
			.getAll()
			.filter(function (item) {
				return item.data.content_type == "film";
			})
			.sort(function (a, b) {
				return a.date - b.date;
			});

		return contentsByYear(coll);
	});

	eleventyConfig.addCollection("combined", function (collection) {
		const coll = collection
			.getAll()
			.filter(function (item) {
				return (
					item.data.content_type == "book" || item.data.content_type == "post" || item.data.content_type == "film"
				);
			})
			.sort(function (a, b) {
				return a.date - b.date;
			});

		return [...coll].reverse();
	});

	// Official plugins
	eleventyConfig.addPlugin(pluginRss);
	eleventyConfig.addPlugin(pluginSyntaxHighlight, {
		preAttributes: { tabindex: 0 }
	});
	eleventyConfig.addPlugin(pluginNavigation);
	eleventyConfig.addPlugin(HtmlBasePlugin);
	eleventyConfig.addPlugin(InputPathToUrlTransformPlugin);

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

	// Filters
	eleventyConfig.addPlugin(pluginFilters);

	const mdLib = markdownIt({
		html: true,
		breaks: true,
		linkify: false,
		typographer: true
	});
	eleventyConfig.setLibrary("md", mdLib);
	// Customize Markdown library settings:
	eleventyConfig.amendLibrary("md", mdLib => {
		mdLib.use(markdownItAnchor, {
			permalink: markdownItAnchor.permalink.ariaHidden({
				placement: "after",
				class: "header-anchor",
				symbol: "#",
				ariaHidden: false,
			}),
			level: [1,2,3,4],
			slugify: eleventyConfig.getFilter("slugify")
		})
		.use(markdownItAttrs)
		.use(markdownItFootnote)
		.use(markdownItImageFigures, {figcaption: true});

		mdLib.renderer.rules.footnote_ref = (tokens, idx, options, env, slf) => {
			const id = slf.rules.footnote_anchor_name(tokens, idx, options, env, slf)
			const caption = slf.rules.footnote_caption(tokens, idx, options, env, slf)
			let refid = id

			if (tokens[idx].meta.subId > 0) refid += `:${tokens[idx].meta.subId}`

			return `<sup class="footnote-ref" id="fn-anchor-${id}"><a href="#fn${id}" id="fnref${refid}">${caption}</a></sup>`
		}

		mdLib.renderer.rules.footnote_caption = (tokens, idx) => {
			let n = Number(tokens[idx].meta.id + 1).toString();

			if (tokens[idx].meta.subId > 0) {
				n += ":" + tokens[idx].meta.subId;
			}

			return n;
		};
	});





	// Filters

	// this does not seem to work within njk files!
	eleventyConfig.addFilter("markdown", function (data) {
		return mdLib.renderInline(data);
	});

	eleventyConfig.addFilter("isRewatch", (data) => {
		return data ? "Yes" : "No";
	});

	eleventyConfig.addFilter("currentBuildDate", (data) => {
		return (new Date());
	});

	// Map from Object filter, for Year-based custom collections
	eleventyConfig.addNunjucksFilter("createReverseYearsMapFromObject", function (obj) {
		const yearCollection = obj;
		let yearCollectionDescending = new Map();
		const keysSorted = Object.keys(yearCollection).sort(function(a,b){return Number(b)-Number(a)});
		keysSorted.forEach((key) => {
			yearCollectionDescending.set(key, yearCollection[key]);
		});
		return yearCollectionDescending;
	});

	// Shortcodes

	eleventyConfig.addShortcode("image", async function (src, alt, sizes) {
		return `<img src="${src}" alt="${alt}" />`;
	});

	eleventyConfig.addPairedShortcode(
		"aside", (content, aside, alignment) => {
			const asideText = mdLib.render(aside.trim());
			const alignmentClass = alignment == 'left' ? 'aside-left-wrap': 'aside-right-wrap';
			const divContent = mdLib.render(content.trim());
			return `<div class="${alignmentClass}"><div class="aside-content">${divContent}</div><aside>${asideText}</aside></div>`;
		}
	);

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

	eleventyConfig.addPairedShortcode(
		"videoloop", (content, data, alt) => {
			const videoURL = mdLib.renderInline(data.trim());
			const altText = mdLib.renderInline(alt.trim());
			const divContent = mdLib.renderInline(content.trim());
			return `<div class="video"><video controls loop autoplay muted playsinline aria-labelledby="video-label" src="${videoURL}"></video>${divContent}<div id="video-label" class="visually-hidden" aria-hidden="true">${altText}</div></div>`;
		}
	);

	eleventyConfig.addPairedShortcode(
		"vimeo", (data) => {
			const videoURL = mdLib.renderInline(data.trim());
			return `<figure class="cinemascope video"><div class="video-embed"><div><iframe src="${videoURL}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div><script src="https://player.vimeo.com/api/player.js"></script></figure>`;
		}
	);

	// Features to make your build faster (when you need them)

	// If your passthrough copy gets heavy and cumbersome, add this line
	// to emulate the file copy on the dev server. Learn more:
	// https://www.11ty.dev/docs/copy/#emulate-passthrough-copy-during-serve

	// eleventyConfig.setServerPassthroughCopyBehavior("passthrough");
};

export const config = {
	// Control which files Eleventy will process
	// e.g.: *.md, *.njk, *.html, *.liquid
	templateFormats: [
		"md",
		"njk",
		"html",
		"liquid",
	],

	// Pre-process *.md files with: (default: `liquid`)
	markdownTemplateEngine: "njk",

	// Pre-process *.html files with: (default: `liquid`)
	htmlTemplateEngine: "njk",

	// These are all optional:
	dir: {
		input: "content",          // default: "."
		includes: "../_includes",  // default: "_includes" (`input` relative)
		data: "../_data",          // default: "_data" (`input` relative)
		output: "_site"
	},

	// -----------------------------------------------------------------
	// Optional items:
	// -----------------------------------------------------------------

	// If your site deploys to a subdirectory, change `pathPrefix`.
	// Read more: https://www.11ty.dev/docs/config/#deploy-to-a-subdirectory-with-a-path-prefix

	// When paired with the HTML <base> plugin https://www.11ty.dev/docs/plugins/html-base/
	// it will transform any absolute URLs in your HTML to include this
	// folder name and does **not** affect where things go in the output folder.

	// pathPrefix: "/",
};
