import sizeOf from "image-size";
import path from "path";
import fs from "fs";

function imageSizePlugin(md) {
	const defaultRender = md.renderer.rules.image;
	md.renderer.rules.image = (tokens, idx, options, env, self) => {
		const token = tokens[idx];
		const src = token.attrGet("src");

		if (src && !src.startsWith("http") && env?.page?.inputPath) {
			try {
				const dir = path.dirname(path.resolve(env.page.inputPath));
				const fullPath = path.join(dir, src);
				const buffer = fs.readFileSync(fullPath);
				const { width, height } = sizeOf(buffer);
				const myWidth = width;
				const myHeight = height;
				if (width) token.attrSet("width", String(width));
				if (height) token.attrSet("height", String(height));
			} catch (e) {
				console.error("imageSizePlugin error:", e);
			}
		}

		return defaultRender
			? defaultRender(tokens, idx, options, env, self)
			: self.renderToken(tokens, idx, options);
	}
}

export default imageSizePlugin;
