import { mkdir, copyFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
await mkdir(new URL('public/', root), { recursive: true });
for (const [source, destination] of [
  ['raffle.html', 'index.html'],
  ['raffle.html', 'raffle.html'],
  ['raffle.css', 'raffle.css'],
  ['raffle.js', 'raffle.js'],
]) {
  await copyFile(new URL(source, root), new URL(`public/${destination}`, root));
}
console.log('Firebase Hosting files ready in public/');
