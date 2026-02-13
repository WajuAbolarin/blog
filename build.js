import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { evaluate } from '@mdx-js/mdx';
import matter from 'gray-matter';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';
import rehypeHighlight from 'rehype-highlight';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const POSTS_DIR = 'posts';
const TEMPLATES_DIR = 'templates';
const STATIC_DIR = 'static';
const DIST_DIR = 'dist';

const fontRegular = readFileSync(join(STATIC_DIR, 'SpaceMono-Regular.ttf'));
const fontBold = readFileSync(join(STATIC_DIR, 'SpaceMono-Bold.ttf'));

const satoriOpts = {
  width: 1200,
  height: 630,
  fonts: [
    { name: 'Space Mono', data: fontRegular, weight: 400, style: 'normal' },
    { name: 'Space Mono', data: fontBold, weight: 700, style: 'normal' },
  ],
};

function slugify(filename) {
  return basename(filename, '.mdx');
}

function readTime(content) {
  const words = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 250));
}

function formatDateLong(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateShort(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
  });
}

function formatDateIso(date) {
  return new Date(date).toISOString().split('T')[0];
}

async function compileMdx(source) {
  const { default: MDXContent } = await evaluate(source, {
    ...jsxRuntime,
    rehypePlugins: [rehypeHighlight],
  });

  return renderToStaticMarkup(React.createElement(MDXContent, null));
}

function generatePostsHtml(posts) {
  const grouped = {};
  for (const post of posts) {
    const year = new Date(post.date).getFullYear();
    if (!grouped[year]) grouped[year] = [];
    grouped[year].push(post);
  }

  const years = Object.keys(grouped).sort((a, b) => b - a);
  let html = '';

  for (const year of years) {
    html += `<div class="year-group">\n`;
    html += `  <div class="year-label">${year}</div>\n`;
    for (const post of grouped[year]) {
      html += `  <a href="/posts/${post.slug}" class="post-item">\n`;
      html += `    <span class="post-date">${formatDateShort(post.date)}</span>\n`;
      html += `    <span class="post-title">${post.title}</span>\n`;
      html += `  </a>\n`;
    }
    html += `</div>\n`;
  }

  return html;
}

function generateRss(posts) {
  const items = posts
    .map(
      (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>https://waju.dev/posts/${post.slug}</link>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description>${escapeXml(post.description || '')}</description>
    </item>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Waju Abolarin</title>
    <link>https://waju.dev</link>
    <description>Writing about systems, software architecture, and building reliable software.</description>
${items}
  </channel>
</rss>`;
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function svgToPng(svg) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  return resvg.render().asPng();
}

function postOgLayout(title, date, readTimeMin) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#1A1A1A',
        padding: '80px',
        fontFamily: 'Space Mono',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { display: 'flex', alignItems: 'center', gap: '16px' },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    width: '48px',
                    height: '48px',
                    backgroundColor: '#C4553A',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    fontSize: '18px',
                    fontWeight: 700,
                    letterSpacing: '1px',
                  },
                  children: 'WA',
                },
              },
              {
                type: 'div',
                props: {
                  style: { color: '#F0EDED', fontSize: '20px', fontWeight: 700 },
                  children: 'waju.dev',
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              flex: 1,
              gap: '24px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    color: '#F0EDED',
                    fontSize: '44px',
                    fontWeight: 700,
                    lineHeight: 1.2,
                  },
                  children: title,
                },
              },
              {
                type: 'div',
                props: {
                  style: { color: '#A0A0A0', fontSize: '18px' },
                  children: `${formatDateLong(date)}  ·  ${readTimeMin} min read`,
                },
              },
            ],
          },
        },
      ],
    },
  };
}

function homeOgLayout() {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#1A1A1A',
        padding: '80px',
        fontFamily: 'Space Mono',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              width: '64px',
              height: '64px',
              backgroundColor: '#C4553A',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontSize: '24px',
              fontWeight: 700,
              letterSpacing: '2px',
            },
            children: 'WA',
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              flex: 1,
              gap: '20px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { color: '#F0EDED', fontSize: '48px', fontWeight: 700 },
                  children: 'Waju Abolarin',
                },
              },
              {
                type: 'div',
                props: {
                  style: { color: '#C4553A', fontSize: '24px', fontWeight: 700 },
                  children: 'SOFTWARE ENGINEER',
                },
              },
              {
                type: 'div',
                props: {
                  style: { color: '#A0A0A0', fontSize: '20px', lineHeight: 1.6 },
                  children: 'Writing about systems, software architecture, and building reliable software.',
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: { color: '#666666', fontSize: '18px' },
            children: 'waju.dev',
          },
        },
      ],
    },
  };
}

async function generateOgPng(layout) {
  const svg = await satori(layout, satoriOpts);
  return svgToPng(svg);
}

async function build() {
  console.log('Building...');

  // Clean and create dist
  mkdirSync(DIST_DIR, { recursive: true });
  mkdirSync(join(DIST_DIR, 'posts'), { recursive: true });
  mkdirSync(join(DIST_DIR, 'og'), { recursive: true });

  // Copy static files
  if (existsSync(STATIC_DIR)) {
    for (const file of readdirSync(STATIC_DIR)) {
      cpSync(join(STATIC_DIR, file), join(DIST_DIR, file), { recursive: true });
    }
  }

  // Read templates
  const homeTemplate = readFileSync(join(TEMPLATES_DIR, 'home.html'), 'utf-8');
  const postTemplate = readFileSync(join(TEMPLATES_DIR, 'post.html'), 'utf-8');

  // Process posts
  mkdirSync(POSTS_DIR, { recursive: true });
  const posts = [];
  const files = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.mdx'));

  for (const file of files) {
    const raw = readFileSync(join(POSTS_DIR, file), 'utf-8');
    const { data, content } = matter(raw);
    const slug = slugify(file);

    console.log(`  Compiling ${file}...`);
    const html = await compileMdx(content);

    const post = {
      title: data.title,
      date: data.date,
      description: data.description || '',
      slug,
      readTime: readTime(content),
      html,
    };
    posts.push(post);

    // Write post page
    const postHtml = postTemplate
      .replace(/\{\{TITLE\}\}/g, post.title)
      .replace(/\{\{DESCRIPTION\}\}/g, post.description)
      .replace(/\{\{SLUG\}\}/g, post.slug)
      .replace('{{DATE_LONG}}', formatDateLong(post.date))
      .replace('{{DATE_ISO}}', formatDateIso(post.date))
      .replace('{{READ_TIME}}', String(post.readTime))
      .replace('{{CONTENT}}', post.html);

    mkdirSync(join(DIST_DIR, 'posts', slug), { recursive: true });
    writeFileSync(join(DIST_DIR, 'posts', slug, 'index.html'), postHtml);

    // Generate OG image
    const ogPng = await generateOgPng(postOgLayout(post.title, post.date, post.readTime));
    writeFileSync(join(DIST_DIR, 'og', `${slug}.png`), ogPng);
    console.log(`  Generated OG image for ${slug}`);
  }

  // Sort posts by date descending
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Write home page
  const postsHtml = generatePostsHtml(posts);
  const homeHtml = homeTemplate.replace('{{POSTS}}', postsHtml);
  writeFileSync(join(DIST_DIR, 'index.html'), homeHtml);

  // Write RSS
  writeFileSync(join(DIST_DIR, 'rss.xml'), generateRss(posts));

  // Generate home OG image
  const homeOgPng = await generateOgPng(homeOgLayout());
  writeFileSync(join(DIST_DIR, 'og-home.png'), homeOgPng);

  console.log(`Done! ${posts.length} posts built to ${DIST_DIR}/`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
