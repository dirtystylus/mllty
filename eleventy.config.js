import markdownItAnchor from "markdown-it-anchor";
import markdownItAttrs from 'markdown-it-attrs';
import markdownIt from 'markdown-it';

import { InputPathToUrlTransformPlugin, HtmlBasePlugin } from "@11ty/eleventy";
import pluginRss from "@11ty/eleventy-plugin-rss";
import pluginSyntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import pluginNavigation from "@11ty/eleventy-navigation";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import path from "path";

import pluginFilters from "./_config/filters.js";

/** @param {import("@11ty/eleventy").UserConfig} eleventyConfig */
export default async function(eleventyConfig) {
	// Copy the contents of the `public` folder to the output folder
	// For example, `./public/css/` ends up in `_site/css/`
	eleventyConfig
		.addPassthroughCopy({
			"./public/": "/",
			"./node_modules/prismjs/themes/prism-okaidia.css": "/css/prism-okaidia.css"
		})
		.addPassthroughCopy("./content/feed/pretty-atom-feed.xsl")
		.addPassthroughCopy("content/blog/**/*.jpg")
		.addPassthroughCopy("content/blog/**/*.mp4");

	// Run Eleventy when these files change:
	// https://www.11ty.dev/docs/watch-serve/#add-your-own-watch-targets

	// Watch content images for the image pipeline.
	eleventyConfig.addWatchTarget("content/**/*.{svg,webp,png,jpeg}");

	// Per-page bundles, see https://github.com/11ty/eleventy-plugin-bundle
	// Adds the {% css %} paired shortcode
	eleventyConfig.addBundle("css");
	// Do you want a {% js %} bundle shortcode too?
	// eleventyConfig.addBundle("js");

	// Official plugins
	eleventyConfig.addPlugin(pluginRss);
	eleventyConfig.addPlugin(pluginSyntaxHighlight, {
		preAttributes: { tabindex: 0 }
	});
	eleventyConfig.addPlugin(pluginNavigation);
	eleventyConfig.addPlugin(HtmlBasePlugin);
	eleventyConfig.addPlugin(InputPathToUrlTransformPlugin);

	// Image optimization: https://www.11ty.dev/docs/plugins/image/#eleventy-transform
	eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
		// File extensions to process in _site folder
		extensions: "html",
		// Output formats for each image.
		formats: ["auto"],
		widths: [320,640,960,1280,1920],
		transformOnRequest: true,
		urlFormat: function ({
			hash, // not included for `statsOnly` images
			src,
			width,
			format,
		}) {
			return `/.netlify/images?url=${src.replace("content","")}?w=${width}&fit=contain`;
		},

		defaultAttributes: {
			// e.g. <img loading decoding> assigned on the HTML tag will override these values.
			loading: "lazy",
			decoding: "async",
			sizes: '(min-width: 45em) 640px,(min-width: 60em) 960px,100vw'
		},
		// filenameFormat: function (id, src, width, format) {
		// 		let filename = path.basename(src, path.extname(src));
		// 		return `${filename}.${format}`;
		// },
	});

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
		});
		mdLib.use(markdownItAttrs);
	});

	eleventyConfig.addShortcode("currentBuildDate", () => {
		return (new Date()).toISOString();
	});

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
		"gallery", (data) => {
			const galleryContent = mdLib.render(data);
			return `<div class="gallery">${galleryContent}</div>`;
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
