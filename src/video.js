// src/video.js
// 타임랩스 영상 메이커: 선택한 4컷을 프레임 안에서 동시에 재생하며 오프스크린 캔버스에 그려 녹화 → mp4(안 되면 webm).
// 영상 길이 = 가장 긴 컷의 '실제 촬영 시간(ms)' ÷ SPEED. (프레임 개수/FPS에 의존하지 않아 항상 정확)
import { drawStrip } from './strip.js';

export function createVideoMaker({ layout, cutFrames, cutDurations, getFrameLayer, getCaption, getCaptionColor, getDate, getStickers }) {
  const CW = layout.canvasSize.w;
  const CH = layout.canvasSize.h;
  const canvas = document.createElement('canvas'); // 오프스크린(녹화 전용)
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext('2d');

  // 재생 속도. 1 = 실제 촬영 시간 그대로(예: 8초 카운트다운 → 8초 영상), 2 = 2배속(4초). 클수록 빠르고 짧아짐.
  const SPEED = 1;
  const durs = cutFrames.map((_, i) => Math.max(1, (cutDurations && cutDurations[i]) || 1000));
  const maxMs = Math.max(1, ...durs);
  const durationSeconds = (maxMs / 1000) / SPEED;

  let raf = null, startT = 0;

  // 시간 비율 기반: 각 컷의 프레임을 그 컷의 실제 촬영시간에 고르게 펼쳐 재생(짧은 컷은 반복).
  function draw(now) {
    if (!startT) startT = now;
    const videoMs = (now - startT) * SPEED; // 진행된 '실제 촬영 시간'
    const imgs = layout.cutLayout.map((_, i) => {
      const arr = cutFrames[i] || [];
      if (!arr.length) return null;
      const dur = durs[i];
      const posMs = videoMs % dur; // 짧은 컷은 반복
      const idx = Math.min(arr.length - 1, Math.floor((posMs / dur) * arr.length));
      return arr[idx];
    });
    drawStrip(ctx, layout, imgs, getFrameLayer(), {
      caption: getCaption(), captionColor: getCaptionColor(), date: getDate(),
    });
    const sts = getStickers();
    for (const st of sts) ctx.drawImage(st.source, st.x, st.y, st.w, st.h);
    raf = requestAnimationFrame(draw);
  }
  function startLoop() { if (raf) return; startT = 0; raf = requestAnimationFrame(draw); }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = null; }

  // mp4 먼저, 안 되면 webm. { m: mimeType, e: 확장자 }
  function pickMime() {
    if (!window.MediaRecorder) return null;
    const cands = [
      { m: 'video/mp4;codecs=avc1.42E01E', e: 'mp4' },
      { m: 'video/mp4', e: 'mp4' },
      { m: 'video/webm;codecs=vp9', e: 'webm' },
      { m: 'video/webm;codecs=vp8', e: 'webm' },
      { m: 'video/webm', e: 'webm' },
    ];
    return cands.find((c) => MediaRecorder.isTypeSupported(c.m)) || { m: '', e: 'webm' };
  }

  // durationSeconds 만큼 녹화 → onDone(Blob, ext). 미지원이면 onError(msg).
  function record(onDone, onError) {
    const picked = pickMime();
    if (!picked) { onError && onError('이 브라우저는 영상 저장을 지원하지 않아요 (크롬 권장).'); return; }

    startLoop();
    let stream;
    try {
      stream = canvas.captureStream(30);
    } catch (e) {
      stopLoop();
      onError && onError('영상 캡처를 지원하지 않는 브라우저예요.');
      return;
    }
    let rec;
    try {
      rec = new MediaRecorder(stream, picked.m ? { mimeType: picked.m } : undefined);
    } catch (e) {
      stopLoop();
      onError && onError('영상 인코더 생성 실패: ' + e.message);
      return;
    }
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      stopLoop();
      onDone && onDone(new Blob(chunks, { type: picked.m || 'video/webm' }), picked.e);
    };
    rec.start();
    setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, durationSeconds * 1000);
  }

  return { record };
}
