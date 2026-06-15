export default {
  layout: "blog-post.njk",
  tags: ["blogPost"],
  eleventyComputed: {
    permalink: (data) => `/blog/${data.slug}/index.html`,
  },
};
