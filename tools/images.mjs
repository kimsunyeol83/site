// 원본 사진을 웹용(WebP, 800px·1600px)으로 줄여 img/ 에 넣고, 크기를 content/images.json 에 기록한다.
// 사용: node tools/images.mjs
// 필요: ffmpeg, ffprobe (PATH에 있어야 함)
// 원본 위치: _원본/images/<id>.<확장자>  ->  img/work/<id 앞 8자리>-800.webp, -1600.webp
//           _원본/covers/<slug>.<확장자> ->  img/cover/<slug>.webp (1200px), <slug>-2400.webp (2400px, 큰 화면용)
//           원본이 2400px보다 작으면 원본 크기 그대로 만든다(키우지 않는다).
//           예전 표지를 보관할 때는 covers 가 아닌 다른 폴더(_원본/covers_이전/)에 둔다.
// 이미 만들어진 파일은 건너뛴다. 다시 만들려면 img/ 안의 해당 파일을 지우고 실행한다.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawImages = path.join(root, '_원본', 'images');
const rawCovers = path.join(root, '_원본', 'covers');
const outWork = path.join(root, 'img', 'work');
const outCover = path.join(root, 'img', 'cover');
const dimsFile = path.join(root, 'content', 'images.json');
fs.mkdirSync(outWork, { recursive: true });
fs.mkdirSync(outCover, { recursive: true });

async function convert(src, dst, width, quality) {
  if (fs.existsSync(dst) && fs.statSync(dst).size > 0) return;
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', `scale='min(${width},iw)':-2:flags=lanczos`, '-frames:v', '1', '-c:v', 'libwebp', '-quality', String(quality), '-compression_level', '5', dst]);
}
async function size(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]);
  const [w, h] = stdout.trim().split(',').map(Number);
  return { w, h };
}

const dims = fs.existsSync(dimsFile) ? JSON.parse(fs.readFileSync(dimsFile, 'utf8')) : {};
const jobs = [];
if (fs.existsSync(rawImages)) {
  for (const f of fs.readdirSync(rawImages)) {
    const id = f.slice(0, 8);
    jobs.push(async () => {
      const src = path.join(rawImages, f);
      const big = path.join(outWork, `${id}-1600.webp`);
      await convert(src, big, 1600, 80);
      await convert(src, path.join(outWork, `${id}-800.webp`), 800, 78);
      dims[id] = await size(big);
    });
  }
}
if (fs.existsSync(rawCovers)) {
  for (const f of fs.readdirSync(rawCovers)) {
    const slug = f.replace(/\.[^.]+$/, '');
    jobs.push(async () => {
      const src = path.join(rawCovers, f);
      await convert(src, path.join(outCover, `${slug}.webp`), 1200, 80);
      const big = path.join(outCover, `${slug}-2400.webp`);
      await convert(src, big, 2400, 78);
      dims[`cover/${slug}`] = await size(big);
    });
  }
}

let done = 0;
let failed = 0;
async function worker() {
  while (jobs.length) {
    const job = jobs.shift();
    try {
      await job();
    } catch (e) {
      failed++;
      console.error('실패:', e.message.split('\n')[0]);
    }
    done++;
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
const sorted = Object.fromEntries(Object.entries(dims).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(dimsFile, JSON.stringify(sorted, null, 1) + '\n');
console.log(`처리 ${done}건, 실패 ${failed}건`);
