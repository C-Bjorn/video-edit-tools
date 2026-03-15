#!/usr/bin/env node
/**
 * video-edit-tools 소개 영상 생성 스크립트
 *
 * 사용법: node examples/intro-video/generate.mjs
 * 출력:   examples/intro-video/output/intro.mp4
 */
import path from 'path';
import { writeFile, mkdir } from 'fs/promises';
import sharp from 'sharp';
import Ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';

import { addText }         from 'image-edit-tools/dist/ops/add-text.js';
import { drawShape }       from 'image-edit-tools/dist/ops/draw-shape.js';
import { composite }       from 'image-edit-tools/dist/ops/composite.js';

import { concat }        from 'video-edit-tools/dist/ops/concat.js';
import { replaceAudio }  from 'video-edit-tools/dist/ops/replace-audio.js';
import { convert }       from 'video-edit-tools/dist/ops/convert.js';

Ffmpeg.setFfmpegPath(ffmpegPath.path);

const __dir  = path.dirname(new URL(import.meta.url).pathname);
const SLIDES_DIR = path.resolve(__dir, 'output/slides');
const OUTPUT_DIR = path.resolve(__dir, 'output');
const BGM_PATH   = path.resolve(__dir, 'assets/bgm.mp3');
const W = 1280, H = 720;

async function solidBg(hex, w = W, h = H) {
  return sharp({
    create: { width: w, height: h, channels: 4, background: hex }
  }).png().toBuffer();
}

async function alphaRect(hex, alpha, w, h) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return sharp({
    create: { width: w, height: h, channels: 4, background: { r, g, b, alpha } }
  }).png().toBuffer();
}

async function over(base, overlay, x, y) {
  const compResult = await composite(base, { layers: [{ image: overlay, x: Math.round(x), y: Math.round(y) }] });
  if (!compResult.ok) throw new Error("composite error: " + compResult.error);
  return compResult.data;
}

async function tx(buf, layers) {
  const res = await addText(buf, { layers: layers.map(l => ({...l, x: Math.round(l.x||0), y: Math.round(l.y||0)})) });
  if (!res.ok) throw new Error("addText error: " + res.error);
  return res.data;
}

async function pill(label, pillW, color = '#6366F1') {
  let shapeRes = await drawShape({
    width: pillW, height: 52, shape: 'rect', fill: color, borderRadius: 26
  });
  if (!shapeRes.ok) throw new Error("drawShape error: " + shapeRes.error);
  const textRes = await addText(shapeRes.data, {
    layers: [{ text: label, x: pillW / 2, y: 26, fontSize: 18, color: '#FFFFFF', anchor: 'middle-center', fontFamily: 'sans-serif', fontWeight: 'bold' }]
  });
  if (!textRes.ok) throw new Error("addText error in pill: " + textRes.error);
  return textRes.data;
}

async function circle(hexColor, size, opacity = 1) {
  const svg = `<svg width="${size*2}" height="${size*2}" viewBox="0 0 ${size*2} ${size*2}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size}" cy="${size}" r="${size}" fill="${hexColor}" fill-opacity="${opacity}" /></svg>`;
  return Buffer.from(svg);
}

// === Slide Generators ===

async function slide1() {
  const accent = '#6366F1';
  let buf = await solidBg('#08090F');
  buf = await over(buf, await alphaRect(accent, 1, W, 6), 0, 0);

  const glow = await circle(accent, 300, 0.08);
  const compResult = await composite(buf, { layers: [{ image: glow, x: W - 620, y: Math.floor(H / 2) - 300, blend: 'screen' }] });
  buf = compResult.data;

  const b1 = await pill('NEW  v1.0.0', 170, accent);
  buf = await over(buf, b1, 60, 120);

  buf = await tx(buf, [
    { text: 'video-edit-tools', x: 60, y: 210, fontSize: 82, color: '#FFFFFF', fontFamily: 'monospace' },
    { text: '결정적(Deterministic) 영상 편집 SDK', x: 60, y: 322, fontSize: 30, color: '#94A3B8', fontFamily: 'sans-serif' },
    { text: 'AI 에이전트를 위한 · MCP 번들 · Zero Python', x: 60, y: 368, fontSize: 26, color: '#475569', fontFamily: 'sans-serif' },
    { text: 'npm install video-edit-tools', x: 60, y: H - 80, fontSize: 26, color: accent, fontFamily: 'monospace' }
  ]);

  const features = ['25 Operations', 'MCP Server', 'TypeScript', 'fluent-ffmpeg'];
  const dot = await circle(accent, 5);
  for (let i = 0; i < features.length; i++) {
    const cx = 60 + i * 280;
    buf = await over(buf, dot, cx, 442 - 5 + 13 - 1);
    buf = await tx(buf, [{ text: features[i], x: cx + 24, y: 442, fontSize: 22, color: '#CBD5E1', fontFamily: 'sans-serif' }]);
  }
  return buf;
}

async function slide2() {
  const accent = '#EF4444';
  let buf = await solidBg('#08090F');
  buf = await over(buf, await alphaRect(accent, 1, W, 6), 0, 0);

  buf = await tx(buf, [{ text: '기존 AI 영상 편집의 한계', x: W / 2, y: 68, anchor: 'top-center', fontSize: 44, color: '#F1F5F9', fontFamily: 'sans-serif', fontWeight: 'bold' }]);

  const cards = [
    { num: '01', title: '재생성 = 비결정적', desc: '프롬프트마다 다른 결과 — 자동화 파이프라인에 치명적', x: 60, y: 168 },
    { num: '02', title: '속도 · 비용 문제', desc: '영상 1개에 수십 초 · 매 요청 API 호출 · 토큰 소모', x: 670, y: 168 },
    { num: '03', title: 'Python 의존성', desc: 'moviepy·OpenCV·CUDA — pip 충돌, venv 지옥', x: 60, y: 388 },
    { num: '04', title: '정밀 편집 불가', desc: '"2초 자르기" "자막 추가" 같은 요청을 코드로 처리 불가', x: 670, y: 388 },
  ];

  for (const c of cards) {
    let cardBuf = await alphaRect('#111827', 0.9, 580, 180);
    cardBuf = await over(cardBuf, await alphaRect(accent, 1, 580, 4), 0, 0);
    cardBuf = await over(cardBuf, await alphaRect(accent, 1, 48, 48), 20, 20);
    cardBuf = await tx(cardBuf, [
      { text: c.num, x: 20 + 24, y: 20 + 24, anchor: 'middle-center', fontSize: 20, color: '#FFFFFF', fontFamily: 'monospace', fontWeight: 'bold' },
      { text: c.title, x: 84, y: 20, fontSize: 26, color: '#F1F5F9', fontFamily: 'sans-serif', fontWeight: 'bold' },
      { text: c.desc, x: 20, y: 84, fontSize: 19, color: '#64748B', fontFamily: 'sans-serif' }
    ]);
    buf = await over(buf, cardBuf, c.x, c.y);
  }
  return buf;
}

async function slide3() {
  const accent = '#10B981';
  let buf = await solidBg('#08090F');
  buf = await over(buf, await alphaRect(accent, 1, W, 6), 0, 0);

  buf = await tx(buf, [
    { text: '25개 함수, 한 줄 설치', x: W / 2, y: 52, anchor: 'top-center', fontSize: 48, color: '#F1F5F9', fontFamily: 'sans-serif', fontWeight: 'bold' },
    { text: 'npm install video-edit-tools', x: W / 2, y: 116, anchor: 'top-center', fontSize: 26, color: accent, fontFamily: 'monospace' }
  ]);

  const rows = [
    { color: '#6366F1', items: ['trim()', 'concat()', 'resize()', 'crop()', 'changeSpeed()'] },
    { color: '#10B981', items: ['addText()', 'addSubtitles()', 'composite()', 'blurRegion()', 'addTransition()'] },
    { color: '#F59E0B', items: ['extractAudio()', 'replaceAudio()', 'adjustVolume()', 'transcribe()', 'muteSection()'] },
    { color: '#EC4899', items: ['adjust()', 'applyFilter()', 'detectScenes()', 'generateThumbnail()', 'pipeline()'] },
  ];

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      const cx = 40 + c * (228 + 16);
      const cy = 192 + r * (88 + 28);
      let shapeRes = await drawShape({
        width: 228, height: 88, shape: 'rect',
        fill: rows[r].color, fillOpacity: 0.12, borderRadius: 10
      });
      let cellBuf = shapeRes.data;
      cellBuf = await tx(cellBuf, [
        { text: rows[r].items[c], x: 114, y: 44, anchor: 'middle-center', fontSize: 18, color: rows[r].color, fontFamily: 'monospace' }
      ]);
      buf = await over(buf, cellBuf, cx, cy);
    }
  }
  return buf;
}

async function slide4() {
  const accent = '#F59E0B';
  let buf = await solidBg('#08090F');
  buf = await over(buf, await alphaRect(accent, 1, W, 6), 0, 0);

  buf = await tx(buf, [
    { text: 'pipeline() — 하나의 호출로 완결', x: 60, y: 52, fontSize: 40, color: '#F1F5F9', fontFamily: 'sans-serif', fontWeight: 'bold' }
  ]);

  let editorBuf = await alphaRect('#0D1117', 1, 740, 520);
  editorBuf = await over(editorBuf, await alphaRect('#161B22', 1, 740, 40), 0, 0);
  editorBuf = await over(editorBuf, await circle('#FF5F56', 6.5), 20 - 6.5, 20 - 6.5);
  editorBuf = await over(editorBuf, await circle('#FFBD2E', 6.5), 44 - 6.5, 20 - 6.5);
  editorBuf = await over(editorBuf, await circle('#27C93F', 6.5), 68 - 6.5, 20 - 6.5);
  
  editorBuf = await tx(editorBuf, [
    { text: 'workflow.ts', x: 370, y: 20, anchor: 'middle-center', fontSize: 14, color: '#8B949E', fontFamily: 'monospace' }
  ]);

  const codeLines = [
    { text: "import { pipeline } from 'video-edit-tools';", color: '#E2E8F0' },
    { text: "" },
    { text: "const r = await pipeline(sourceVideo, [", color: '#569CD6' },
    { text: "  { op: 'trim',      start: 10, end: 40 },", color: '#CE9178' },
    { text: "  { op: 'resize',    width: 1080, height: 1920, fit: 'cover' },", color: '#CE9178' },
    { text: "  { op: 'addText',   layers: [{ text: '하이라이트', x: 540, y: 80,", color: '#9CDCFE' },
    { text: "                      fontSize: 56, color: '#fff', anchor: 'top-center' }] },", color: '#9CDCFE' },
    { text: "  { op: 'gradientOverlay', direction: 'bottom', opacity: 0.6 },", color: '#CE9178' },
    { text: "  { op: 'adjustVolume', normalize: true },", color: '#CE9178' },
    { text: "  { op: 'convert',   format: 'mp4', quality: 85 },", color: '#CE9178' },
    { text: "]);", color: '#569CD6' },
    { text: "" },
    { text: "if (r.ok) save(r.data);  // 항상 동일한 출력", color: '#6A9955' },
  ];

  let cy = 56;
  const layers = [];
  for (const line of codeLines) {
    if (line.text) {
      layers.push({ text: line.text, x: 24, y: cy, fontSize: 18, color: line.color, fontFamily: 'monospace' });
    }
    cy += 28;
  }
  editorBuf = await tx(editorBuf, layers);
  buf = await over(buf, editorBuf, 60, 114);

  let panelBuf = await alphaRect('#111827', 0.95, 388, 520);
  panelBuf = await over(panelBuf, await alphaRect(accent, 1, 388, 4), 0, 0);

  const steps = [
    { num: '01', fn: 'trim()', desc: '10~40초 구간 추출' },
    { num: '02', fn: 'resize()', desc: '9:16 세로 포맷' },
    { num: '03', fn: 'addText()', desc: '타이틀 자막' },
    { num: '04', fn: 'gradientOverlay()', desc: '하단 그라디언트' },
    { num: '05', fn: 'adjustVolume()', desc: '음량 자동 정규화' },
    { num: '06', fn: 'convert()', desc: 'MP4 최적화 출력' },
  ];

  let sy = 20;
  for (const s of steps) {
    panelBuf = await over(panelBuf, await alphaRect(accent, 1, 36, 36), 20, sy);
    panelBuf = await tx(panelBuf, [
      { text: s.num, x: 20 + 18, y: sy + 18, anchor: 'middle-center', fontSize: 16, color: '#FFFFFF', fontFamily: 'monospace', fontWeight: 'bold' },
      { text: s.fn, x: 72, y: sy + 6, fontSize: 19, color: '#FBBF24', fontFamily: 'monospace', fontWeight: 'bold' },
      { text: s.desc, x: 72, y: sy + 32, fontSize: 16, color: '#64748B', fontFamily: 'sans-serif' }
    ]);
    sy += 76;
  }
  buf = await over(buf, panelBuf, 820, 114);
  return buf;
}

async function slide5() {
  const accent = '#818CF8';
  let buf = await solidBg('#08090F');
  buf = await over(buf, await alphaRect(accent, 1, W, 6), 0, 0);

  buf = await tx(buf, [
    { text: 'MCP 서버 번들 내장', x: W / 2, y: 52, anchor: 'top-center', fontSize: 50, color: '#FFFFFF', fontFamily: 'sans-serif', fontWeight: 'bold' },
    { text: 'Claude · Cursor · Windsurf에서 설정 한 줄이면 완료', x: W / 2, y: 118, anchor: 'top-center', fontSize: 26, color: '#A5B4FC', fontFamily: 'sans-serif' }
  ]);

  let jsonBuf = await alphaRect('#0D1117', 1, 720, 230);
  jsonBuf = await over(jsonBuf, await alphaRect('#161B22', 1, 720, 36), 0, 0);
  jsonBuf = await tx(jsonBuf, [
    { text: 'claude_desktop_config.json', x: 20, y: 8, fontSize: 14, color: '#8B949E', fontFamily: 'monospace' }
  ]);

  const jsonLines = [
    { text: "{", color: '#E2E8F0' },
    { text: '  "mcpServers": {', color: '#E2E8F0' },
    { text: '    "video-edit-tools": {', color: '#9CDCFE' },
    { text: '      "command": "npx",', color: '#CE9178' },
    { text: '      "args": ["video-edit-tools/mcp"]', color: '#CE9178' },
    { text: '    }', color: '#9CDCFE' },
    { text: "  }", color: '#E2E8F0' },
    { text: "}", color: '#E2E8F0' }
  ];
  let jy = 48;
  for (const jl of jsonLines) {
    jsonBuf = await tx(jsonBuf, [{ text: jl.text, x: 24, y: jy, fontSize: 18, color: jl.color, fontFamily: 'monospace' }]);
    jy += 26;
  }
  buf = await over(buf, jsonBuf, 60, 170);

  let toolsBuf = await alphaRect('#1e1b4b', 0.9, 420, 230);
  const toolNames = [
    { name: 'video_trim', c: '#E0E7FF' },
    { name: 'video_add_text', c: '#E0E7FF' },
    { name: 'video_transcribe', c: '#E0E7FF' },
    { name: 'video_pipeline', c: '#E0E7FF' },
    { name: 'video_generate_thumbnail', c: '#E0E7FF' },
    { name: '... 25개 도구', c: accent, bold: true },
  ];
  let ty = 24;
  for (const t of toolNames) {
    toolsBuf = await over(toolsBuf, await circle(accent, 4), 20 - 4, ty + 10 - 4);
    toolsBuf = await tx(toolsBuf, [{ text: t.name, x: 40, y: ty, fontSize: 18, color: t.c, fontFamily: 'monospace', fontWeight: t.bold ? 'bold' : 'normal' }]);
    ty += 34;
  }
  buf = await over(buf, toolsBuf, 820, 170);

  const clients = [
    { name: 'Claude Desktop', x: 200 },
    { name: 'Cursor', x: 540 },
    { name: 'Windsurf', x: 880 }
  ];
  for (const cl of clients) {
    const svgCheck = `<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="24" fill="${accent}" /><path d="M14 24l7 7 13-13" stroke="#FFFFFF" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
    buf = await over(buf, Buffer.from(svgCheck), cl.x - 80, 442 - 24);
    buf = await tx(buf, [{ text: cl.name, x: cl.x - 20, y: 442 - 12, fontSize: 24, color: '#94A3B8', fontFamily: 'sans-serif', fontWeight: 'bold' }]);
  }
  return buf;
}

async function slide6() {
  const accent = '#6366F1';
  let buf = await solidBg('#08090F');
  buf = await over(buf, await alphaRect(accent, 1, W, 6), 0, 0);

  buf = await tx(buf, [
    { text: '지금 시작하세요', x: W / 2, y: 80, anchor: 'top-center', fontSize: 60, color: '#FFFFFF', fontFamily: 'sans-serif', fontWeight: 'bold' },
    { text: 'AI 에이전트 시대, 영상 편집도 자동화됩니다', x: W / 2, y: 162, anchor: 'top-center', fontSize: 26, color: '#C7D2FE', fontFamily: 'sans-serif' }
  ]);

  let link1 = await alphaRect('#4338CA', 0.2, W - 120, 56);
  link1 = await tx(link1, [{ text: '▸   npm install video-edit-tools', x: 40, y: 28, anchor: 'middle-left', fontSize: 22, color: '#FFFFFF', fontFamily: 'monospace' }]);
  buf = await over(buf, link1, 60, 232);

  let link2 = await alphaRect('#4338CA', 0.2, W - 120, 56);
  link2 = await tx(link2, [{ text: '★   github.com/swimmingkiim/video-edit-tools', x: 40, y: 28, anchor: 'middle-left', fontSize: 22, color: '#FFFFFF', fontFamily: 'sans-serif' }]);
  buf = await over(buf, link2, 60, 304);

  let bottomBuf = await solidBg('#F8FAFC', W, 320); 
  let line = await alphaRect('#CBD5E1', 1, 600, 1);
  bottomBuf = await over(bottomBuf, line, (W - 600) / 2, 74); 
  
  bottomBuf = await tx(bottomBuf, [
    { text: '사용 후기 · 구현 사례 · 질문 모두 환영', x: W / 2, y: 28, anchor: 'top-center', fontSize: 28, color: '#1E293B', fontFamily: 'sans-serif', fontWeight: 'bold' },
    { text: 'image-edit-tools  +  video-edit-tools', x: W / 2, y: 100, anchor: 'top-center', fontSize: 24, color: '#4F46E5', fontFamily: 'monospace', fontWeight: 'bold' },
    { text: 'AI 에이전트를 위한 미디어 편집 생태계', x: W / 2, y: 146, anchor: 'top-center', fontSize: 20, color: '#64748B', fontFamily: 'sans-serif' }
  ]);
  buf = await over(buf, bottomBuf, 0, 400);

  return buf;
}

// === Utility: Create Video from Image ===

async function pngToVideo(pngPath, outputPath, durationSec = 7) {
  return new Promise((resolve, reject) => {
    Ffmpeg()
      .input(pngPath)
      .inputOptions(['-loop 1'])
      .input('anullsrc')
      .inputOptions(['-f lavfi'])
      .outputOptions([
        `-t ${durationSec}`,
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-vf', `scale=1280:720,fps=30,fade=in:st=0:d=0.4,fade=out:st=${durationSec - 0.4}:d=0.4`,
        '-c:a aac',
        '-shortest',
        '-preset fast',
      ])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

// === Main Execution Pipeline ===

async function main() {
  await mkdir(SLIDES_DIR, { recursive: true });

  console.log('📸 슬라이드 생성 중...');
  const slideData = [
    { name: 's1-cover',    fn: slide1 },
    { name: 's2-problem',  fn: slide2 },
    { name: 's3-features', fn: slide3 },
    { name: 's4-code',     fn: slide4 },
    { name: 's5-mcp',      fn: slide5 },
    { name: 's6-cta',      fn: slide6 },
  ];
  for (const { name, fn } of slideData) {
    process.stdout.write(`  ${name}... `);
    const buf = await fn();
    await writeFile(path.resolve(SLIDES_DIR, `${name}.png`), buf);
    console.log('OK');
  }

  console.log('\n🎬 PNG → 영상 변환 중...');
  const clipPaths = [];
  for (const { name } of slideData) {
    process.stdout.write(`  ${name}.mp4... `);
    const pngPath = path.resolve(SLIDES_DIR, `${name}.png`);
    const mp4Path = path.resolve(SLIDES_DIR, `${name}.mp4`);
    await pngToVideo(pngPath, mp4Path, 7);
    clipPaths.push(mp4Path);
    console.log('OK');
  }

  console.log('\n🔗 클립 이어붙이기...');
  const concatResult = await concat(clipPaths, { format: 'mp4' });
  if (!concatResult.ok) throw new Error(`concat: ${concatResult.error}`);
  console.log('OK (42초)');

  console.log('\n🎵 배경음악 추가 중...');
  const audioResult = await replaceAudio(concatResult.data, {
    audio: BGM_PATH,
    loop: true,
    fadeIn: 1.5,
    fadeOut: 3.0,
  });
  if (!audioResult.ok) throw new Error(`replaceAudio: ${audioResult.error}`);
  console.log('OK');

  console.log('\n💾 최종 변환 중...');
  const finalResult = await convert(audioResult.data, { format: 'mp4', quality: 85 });
  if (!finalResult.ok) throw new Error(`convert: ${finalResult.error}`);
  const outPath = path.resolve(OUTPUT_DIR, 'intro.mp4');
  await writeFile(outPath, finalResult.data);

  console.log(`\n✅ 완료: ${outPath}`);
  console.log(`   해상도: 1280×720  |  길이: 42초  |  포맷: MP4`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
