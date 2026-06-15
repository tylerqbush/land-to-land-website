import pluginSitemap from "@quasibit/eleventy-plugin-sitemap";

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy({ "src/robots.txt": "robots.txt" });

  eleventyConfig.addPlugin(pluginSitemap, {
    sitemap: { hostname: "https://landtolandholdings.com" },
  });

  // Make properties available on window for the map page
  eleventyConfig.addFilter("json", (value) => JSON.stringify(value));

  // Reading time filter for blog posts
  eleventyConfig.addFilter("readingTime", (content) => {
    const words = content ? content.trim().split(/\s+/).length : 0;
    return Math.max(1, Math.round(words / 200));
  });

  // Collection of non-paginated pages only (workaround for plugin/Eleventy v3 incompatibility
  // where pagination templateContent is accessed too early by @quasibit/eleventy-plugin-sitemap)
  eleventyConfig.addCollection("sitemapPages", (collectionApi) => {
    return collectionApi.getAll().filter((item) => !item.data.pagination);
  });

  // Blog posts collection, sorted by date descending
  eleventyConfig.addCollection("blogPosts", (collectionApi) => {
    return collectionApi
      .getFilteredByTag("blogPost")
      .sort((a, b) => b.date - a.date);
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    templateFormats: ["njk", "html", "md"],
    htmlTemplateEngine: "njk",
  };
}
