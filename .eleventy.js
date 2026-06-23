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

  // Comma-formatted number, e.g. 15998 -> "15,998"
  eleventyConfig.addFilter("numberFormat", (value) => {
    if (value == null) return "";
    return Number(value).toLocaleString("en-US");
  });

  // Cleans up messy Airtable zoning strings for display next to the
  // "Property Rules & Zoning" heading. Airtable has values like
  // 'According to the county, There is no "ZONING"' alongside clean
  // ones like 'Rural Residential (R-2)' — anything that reads as "no
  // zoning on file" collapses to a single plain label.
  eleventyConfig.addFilter("zoningDisplay", (zoning) => {
    const z = (zoning || "").trim();
    if (!z || z.toLowerCase().includes("no")) return "Unzoned / none on file";
    return z;
  });

  // Builds the "Property Rules & Zoning" callout list for a property.
  // Always returns at least 4 callouts. The HOA callout is always
  // included because Airtable has no HOA field at all, so absence is
  // treated as "no HOA" per Tyler's call. Items tied to ambiguous
  // permissions (RV/mobile home use) are worded to put the burden of
  // verifying local zoning on the buyer rather than asserting a fact
  // we can't confirm.
  eleventyConfig.addFilter("zoningCallouts", (prop) => {
    const callouts = [];

    callouts.push("No HOA fees or restrictions");
    callouts.push(
      prop.terrain
        ? `Peaceful, ${prop.terrain.toLowerCase()} setting`
        : "Peaceful rural setting"
    );

    if (
      prop.manufactured_allowed === "Yes" ||
      prop.full_time_rv === "Yes" ||
      prop.rv_while_build === "Yes"
    ) {
      callouts.push("RVs and mobile homes may be permitted (check local zoning)");
    }

    if (prop.time_limit_to_build === "None") {
      callouts.push("Build at your own pace");
    }

    if (prop.tent_camping === "Yes" || prop.camping_rv === "Yes") {
      callouts.push("Camp on your land while you plan");
    }

    if (prop.flood_plain === "No") {
      callouts.push("Not located in a flood zone");
    }

    if (prop.single_family_allowed === "Yes") {
      callouts.push("Room to build a single-family home");
    }

    if (prop.solar === "Yes" || prop.septic === "Yes" || prop.propane === "Yes") {
      callouts.push("Solar, septic, and propane available for off-grid living");
    }

    const fillers = [
      "No bank or credit check required",
      "Simple monthly payments direct from the owner",
    ];
    let i = 0;
    while (callouts.length < 4 && i < fillers.length) {
      callouts.push(fillers[i]);
      i++;
    }

    return callouts.slice(0, 6);
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
