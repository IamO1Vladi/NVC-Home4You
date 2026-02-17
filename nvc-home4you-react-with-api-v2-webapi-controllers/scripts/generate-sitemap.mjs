import { SitemapStream, streamToPromise } from 'sitemap';
import { createWriteStream } from 'node:fs';

const baseUrl = 'https://www.example.com'; // <- change to your domain
const urls = ['/', '/about', '/contact'];  // <- extend to match your routes

const smStream = new SitemapStream({ hostname: baseUrl });
const writeStream = createWriteStream('public/sitemap.xml');
smStream.pipe(writeStream);

urls.forEach((u) => smStream.write({ url: u, changefreq: 'weekly', priority: 0.7 }));
smStream.end();

await streamToPromise(smStream);
console.log('✅ sitemap.xml written to public/');
