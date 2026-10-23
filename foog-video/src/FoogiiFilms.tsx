import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import '@fontsource/archivo/500.css';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo/800.css';
import '@fontsource/archivo/900.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/500-italic.css';
import '@fontsource/jetbrains-mono/700.css';
import { BEAT, Bubble, Caption, CHALK, DROP1, FoogMark, Foogii, FPS, img, MIDNIGHT, s, Shot, Title, VOLT, beatPulse, shake } from './lib';
import { Viewfinder } from './Viewfinder';
import { LYRICS } from './lyrics';

// ---------------------------------------------------------------- vaqt jadvali (soniya)
const BAR = BEAT * 4;
const bar = (k: number) => DROP1 + BAR * k; // kuchli zarbdan keyingi taktlar
const LOUD2 = 157.7; // naqarot oldidagi sokinlikda
const END_SONG = 180.0;
const LOUD3 = 180.15; // logotip
export const DURATION = s(184.5);

type St = { n: string; x: number; y: number; size: number; d?: number; flip?: boolean; rot?: number };
type Scene = { at: number; end: number; bg: string; pos?: string; pan?: [number, number]; st?: St[]; title?: { lines: string[]; y?: number; accent?: number; size?: number; d?: number }; chip?: string; selfie?: boolean; night?: boolean };

// stikerlar uchun qisqa yozuv
const R = (n: string, d = 0.15, size = 520, flip = false): St => ({ n, x: 760, y: 1200, size, d, flip });
const L = (n: string, d = 0.15, size = 520, flip = false): St => ({ n, x: 320, y: 1200, size, d, flip });
const C = (n: string, d = 0.1, size = 760): St => ({ n, x: 540, y: 1080, size, d });

const SCENES: Scene[] = [
  // --- kirish: FOOGII kamerani yoqadi (sokin)
  { at: 0, end: 5.6, bg: 'vl_stadium', selfie: true, st: [C('02_11_selfie', 0.9, 820)] },
  { at: 5.6, end: 10.98, bg: 'fl_stadium', night: true, st: [{ n: '02_12_camera_filming', x: 300, y: 1300, size: 620, d: 0.2, flip: true }] },
  { at: 10.98, end: DROP1, bg: 'hero', pan: [0, 0] },
  // --- kuchli zarb
  { at: DROP1, end: bar(1), bg: 'mn_aerial', st: [C('07_03_jump_joy', 0, 780)] },
  // --- "Bir hujum" seriyasi, har takt bitta kadr
  { at: bar(1), end: bar(2), bg: 'c1', chip: 'PAS', st: [R('02_01_dribble', 0.6, 460)] },
  { at: bar(2), end: bar(3), bg: 'c2', chip: 'YUGUR', st: [L('01_01_running_late', 0.6, 460)] },
  { at: bar(3), end: bar(4), bg: 'c3' },
  { at: bar(4), end: bar(5), bg: 'c4', st: [R('02_02_kick', 0.5, 480)] },
  { at: bar(5), end: bar(5.5), bg: 'c5' },
  { at: bar(5.5), end: 30.0, bg: 'c6', title: { lines: ['GOL!'], y: 360, size: 240, accent: 0, d: 0 }, st: [L('02_03_goal_celebration', 0.2, 560)] },
  // --- 1-kuplet
  { at: 30.0, end: 33.58, bg: 'mn_aerial', pan: [0, 60], st: [R('01_03_location_confirmed', 0.3, 480)] },
  { at: 33.58, end: 38.72, bg: 'inside_right', pos: 'center 30%', st: [L('01_06_team_trio', 0.4, 600)] },
  { at: 38.72, end: 41.5, bg: 'vl_stadium', night: true, st: [R('02_05_yellow_card', 0.2, 480)] },
  { at: 41.5, end: 45.52, bg: 'mn_net', st: [L('02_08_gold_star', 0.2, 500)] },
  // --- 1-naqarot
  { at: 45.52, end: 49.54, bg: 'fl_stadium', title: { lines: ['BIRGA', 'QURAMIZ'], y: 330, accent: 1 }, st: [R('05_07_stadium_builder', 0.5, 600)] },
  { at: 49.54, end: 54.38, bg: 'mn_net', title: { lines: ['OLTIN', 'SAHIFA'], y: 330, accent: 0 }, st: [L('05_02_medal', 0.3, 540)] },
  { at: 54.38, end: 59.18, bg: 'mn_left', st: [R('07_08_love_heart', 0.3, 560)], chip: 'JON-DILDAN' },
  { at: 59.18, end: 63.86, bg: 'hero', st: [L('03_09_voice_message', 0.3, 540)], chip: 'BIR QO‘SHIQDA' },
  { at: 63.86, end: 68.76, bg: 'inside_right', pos: 'center 30%', title: { lines: ['FUTBOL', 'TARIXI'], y: 330, accent: 1 }, st: [R('08_04_player_cards', 0.3, 540)] },
  { at: 68.76, end: 74.98, bg: 'mn_aerial', pan: [0, -80], st: [L('05_01_growth_climb', 0.3, 580)], chip: 'BALANDLAR TOMON' },
  // --- 2-kuplet: FOOGII ilovani suratga oladi
  { at: 74.98, end: 79.16, bg: 'fl_stadium', chip: 'STADION TOP', st: [R('08_07_find_stadium', 0.2, 560)] },
  { at: 79.16, end: 81.6, bg: 'mn_mid', chip: 'KECHIKMA', st: [L('01_02_scooter', 0.1, 520)] },
  { at: 81.6, end: 83.94, bg: 'mn_mid', pos: 'center 70%', st: [R('08_10_ticket_confirmed', 0.1, 520)], chip: 'BRON TAYYOR' },
  { at: 83.94, end: 86.5, bg: 'vl_stadium', night: true, st: [L('07_10_sleeping_pillow', 0.1, 520)] },
  { at: 86.5, end: 89.16, bg: 'mn_mid', st: [R('08_01_welcome', 0.1, 540)], chip: 'TONG' },
  { at: 89.16, end: 93.56, bg: 'inside_right', pos: 'center 30%', st: [L('02_09_cone_drills', 0.2, 560)], chip: 'MASHG‘ULOT' },
  { at: 93.56, end: 98.76, bg: 'mn_left', st: [R('03_07_juggling', 0.2, 540)] },
  { at: 98.76, end: 105.14, bg: 'hero', chip: 'FOOG ID', st: [L('05_03_foog_id', 0.2, 580)] },
  // --- 2-naqarot: reels rejimi
  { at: 105.14, end: 109.54, bg: 'c2', title: { lines: ['BIRGA', 'QURAMIZ'], y: 330, accent: 1 }, st: [R('02_11_selfie', 0.3, 560)] },
  { at: 109.54, end: 114.42, bg: 'c4', st: [L('03_01_upload_cloud', 0.3, 540)], chip: 'REELS' },
  { at: 114.42, end: 119.16, bg: 'c5', st: [R('03_06_fire_ball', 0.3, 540)] },
  { at: 119.16, end: 123.88, bg: 'c6', st: [L('02_07_scoreboard_2_1', 0.3, 560)], chip: '2 : 1' },
  { at: 123.88, end: 128.76, bg: 'c1', title: { lines: ['FUTBOL', 'TARIXI'], y: 330, accent: 1 }, st: [R('06_02_fan_flag', 0.3, 560)] },
  { at: 128.76, end: 135.04, bg: 'c3', st: [L('07_12_trophy_win', 0.3, 600)] },
  // --- ko‘prik (sokinroq, kechki)
  { at: 135.04, end: 140.3, bg: 'vl_stadium', night: true, st: [R('04_09_rain_umbrella', 0.4, 560)] },
  { at: 140.3, end: 145.04, bg: 'fl_stadium', night: true, st: [L('01_06_team_trio', 0.4, 600)] },
  { at: 145.04, end: 149.14, bg: 'hero', st: [R('06_02_fan_flag', 0.3, 560)] },
  { at: 149.14, end: 155.1, bg: 'mn_net', st: [L('04_01_security_shield', 0.3, 560)], chip: 'TO‘SIQ YO‘Q' },
  // --- sokinlik: yana old kamera
  { at: 155.1, end: LOUD2, bg: 'vl_stadium', selfie: true, st: [C('03_10_wave_hello', 0.3, 820)] },
  { at: LOUD2, end: 160.32, bg: 'vl_stadium', selfie: true },
  // --- final naqarot: tez kesishlar
  { at: 160.32, end: 162.75, bg: 'c6', title: { lines: ['BIRGA', 'QURAMIZ'], y: 330, accent: 1, d: 0 }, st: [C('07_03_jump_joy', 0.05, 720)] },
  { at: 162.75, end: 164.74, bg: 'mn_aerial', st: [R('01_05_captain', 0.05, 520)] },
  { at: 164.74, end: 167.2, bg: 'c1', st: [L('02_02_kick', 0.05, 520)] },
  { at: 167.2, end: 169.64, bg: 'mn_net', st: [R('05_02_medal', 0.05, 520)] },
  { at: 169.64, end: 172.0, bg: 'inside_right', pos: 'center 30%', st: [L('01_10_lineup_full', 0.05, 560)] },
  { at: 172.0, end: 174.36, bg: 'c5', st: [R('03_06_fire_ball', 0.05, 520)] },
  { at: 174.36, end: 177.0, bg: 'fl_stadium', st: [L('07_12_trophy_win', 0.05, 580)] },
  { at: 177.0, end: LOUD3, bg: 'hero', st: [R('02_03_goal_celebration', 0.05, 600)] },
];

// FOOGII pichirlaydi (sokin joylarda)
const WHISPERS: { at: number; end: number; text: string; x: number; y: number; tail?: 'left' | 'right' | 'none' }[] = [
  { at: 1.6, end: 5.3, text: 'psst… kamera yoqildi', x: 260, y: 420, tail: 'left' },
  { at: 6.3, end: 10.7, text: 'hammasini yozib olaman… hech kimga aytma', x: 330, y: 560, tail: 'left' },
  { at: 11.4, end: 13.2, text: 'sekin… fokus…', x: 260, y: 1180, tail: 'none' },
  { at: 155.8, end: 157.4, text: 'psst… oxirgi naqarot…', x: 260, y: 430, tail: 'left' },
];
// FOOGII baland va jarangdor gapiradi (content.mp3)
const LOUDS: { at: number; end: number; text: string; x: number; y: number; w: number }[] = [
  { at: DROP1, end: bar(1) - 0.1, text: 'FOOG!', x: 190, y: 420, w: 700 },
  { at: LOUD2, end: 160.2, text: 'HAMMA BIRGA!', x: 120, y: 300, w: 840 },
];
const COUNT = [13.41, 14.02, 14.62];

const lyricAt = (t: number) => LYRICS.find(([a, b]) => t >= a && t < b);

const Countdown: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const i = COUNT.findIndex((c, k) => t >= c && t < (COUNT[k + 1] ?? DROP1));
  if (i < 0) return null;
  const lf = f - s(COUNT[i]);
  const sc = interpolate(lf, [0, 6, 18], [1.6, 1, 0.9], { extrapolateRight: 'clamp' });
  return <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Archivo', fontWeight: 900, fontSize: 420, color: VOLT, transform: `scale(${sc})`, opacity: interpolate(lf, [0, 4, 16, 18], [0, 1, 1, 0.2]), textShadow: '0 10px 60px rgba(0,0,0,.6)' }}>{3 - i}</div>;
};

const Chip: React.FC<{ text: string }> = ({ text }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: f - 6, fps, config: { damping: 12, stiffness: 180 } });
  return (
    <div style={{ position: 'absolute', top: 360, left: 90, transform: `translateX(${(1 - sp) * -120}%)`, background: VOLT, color: MIDNIGHT, fontFamily: 'Archivo', fontWeight: 900, fontSize: 64, letterSpacing: '-0.02em', padding: '16px 30px', borderRadius: 999 }}>{text}</div>
  );
};

const SceneView: React.FC<{ sc: Scene; dur: number }> = ({ sc, dur }) => {
  const f = useCurrentFrame();
  // kadrga kirish: qisqa "whip" – xiralik + siljish
  const whip = interpolate(f, [0, 5], [1, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ transform: `translateX(${whip * 140}px)`, filter: whip > 0.01 ? `blur(${whip * 18}px)` : undefined }}>
      {sc.selfie ? (
        <>
          <Shot src={img(sc.bg)} dur={dur} from={1.25} to={1.3} focus={false} />
          <AbsoluteFill style={{ backdropFilter: 'blur(22px)', background: 'rgba(13,18,38,.35)' }} />
        </>
      ) : (
        <Shot src={img(sc.bg)} dur={dur} pan={sc.pan} pos={sc.pos} />
      )}
      {sc.night && <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(13,18,38,.35), rgba(13,18,38,.15) 40%, rgba(13,18,38,.55))' }} />}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.35), transparent 22%, transparent 70%, rgba(0,0,0,.45))' }} />
      {sc.title && <Title lines={sc.title.lines} y={sc.title.y ?? 330} accent={sc.title.accent} size={sc.title.size} delay={s(sc.title.d ?? 0.15)} />}
      {sc.chip && <Chip text={sc.chip} />}
      {sc.st?.map((x, i) => <Foogii key={i} name={x.n} x={x.x} y={x.y} size={x.size} delay={s(x.d ?? 0)} flip={x.flip} rot={x.rot} />)}
    </AbsoluteFill>
  );
};

const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hit = spring({ frame: f, fps, config: { damping: 8, stiffness: 220 } });
  const sub = spring({ frame: f - 14, fps, config: { damping: 14 } });
  const ring = interpolate(f, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: MIDNIGHT, alignItems: 'center', justifyContent: 'center' }}>
      {[0, 1, 2].map((i) => {
        const p = (ring + i / 3) % 1;
        return <div key={i} style={{ position: 'absolute', width: 300 + p * 1400, height: 300 + p * 1400, borderRadius: '50%', border: `6px solid ${VOLT}`, opacity: (1 - p) * 0.35 }} />;
      })}
      <div style={{ position: 'absolute', top: 520, transform: `scale(${0.6 + hit * 0.4})`, opacity: hit }}><FoogMark width={780} /></div>
      <div style={{ position: 'absolute', top: 760, fontFamily: 'Archivo', fontWeight: 900, fontSize: 96, color: VOLT, letterSpacing: '-0.03em', opacity: sub, transform: `translateY(${(1 - sub) * 40}px)` }}>foog.uz</div>
      <div style={{ position: 'absolute', top: 890, fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 36, color: CHALK, opacity: sub * 0.85 }}>STADION TOP · JAMOA YIG‘ · O‘YNA</div>
      <Foogii name="08_01_welcome" x={540} y={1400} size={640} delay={8} />
      <div style={{ position: 'absolute', bottom: 120, fontFamily: 'JetBrains Mono', fontWeight: 500, fontSize: 30, color: 'rgba(247,248,241,.6)' }}>Suratga oldi: FOOGII</div>
    </AbsoluteFill>
  );
};

export const FoogiiFilms: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const sc = SCENES.find((x) => t >= x.at && t < x.end);
  const selfie = !!sc?.selfie;
  // zarb puls va qo‘l titrashi faqat shiddatli qismlarda
  const energy = t < DROP1 ? 0 : t >= 135 && t < 160.32 ? 0.35 : 1;
  const pulse = beatPulse(f) * energy;
  const sh = shake(f, t < DROP1 ? 0.6 : 1);
  const zoom = 1 + pulse * 0.025;
  const flash = (at: number) => interpolate(t, [at, at + 0.05, at + 0.45], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fl = Math.max(flash(DROP1), flash(160.32));
  const lyr = lyricAt(t);
  const camOn = t < LOUD3;
  // tovush: baland FOOGII paytida musiqa pasayadi
  const duck = (fr: number) => {
    const tt = fr / FPS;
    const d = [DROP1, LOUD2].reduce((m, a) => Math.min(m, tt < a - 0.15 || tt > a + 1.6 ? 1 : 0.35), 1);
    const fade = interpolate(tt, [END_SONG - 1.2, END_SONG], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return 0.9 * d * fade;
  };
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Audio src={staticFile('audio/birga-quramiz.m4a')} volume={duck} />
      {LOUDS.map((l) => <Sequence key={l.at} from={s(l.at)} durationInFrames={s(3)}><Audio src={staticFile('audio/foogii-loud.wav')} volume={1} /></Sequence>)}
      <Sequence from={s(LOUD3)} durationInFrames={s(3)}><Audio src={staticFile('audio/foogii-loud.wav')} volume={1} /></Sequence>
      {WHISPERS.map((w) => <Sequence key={w.at} from={s(w.at)} durationInFrames={s(3)}><Audio src={staticFile('audio/foogii-whisper.wav')} volume={0.9} /></Sequence>)}

      {camOn && (
        <AbsoluteFill style={{ transform: `translate(${sh.x}px, ${sh.y}px) rotate(${sh.r}deg) scale(${1.04 * zoom})` }}>
          {SCENES.map((x) => (
            <Sequence key={x.at} from={s(x.at)} durationInFrames={Math.max(1, s(x.end) - s(x.at))}>
              <SceneView sc={x} dur={s(x.end) - s(x.at)} />
            </Sequence>
          ))}
        </AbsoluteFill>
      )}
      {camOn && <Countdown />}
      {camOn && WHISPERS.map((w) => (
        <Sequence key={'w' + w.at} from={s(w.at)} durationInFrames={s(w.end - w.at)}>
          <Bubble text={w.text} x={w.x} y={w.y} whisper w={620} tail={w.tail ?? 'left'} exit={s(w.end - w.at) - 6} />
        </Sequence>
      ))}
      {camOn && LOUDS.map((l) => (
        <Sequence key={'l' + l.at} from={s(l.at)} durationInFrames={s(l.end - l.at)}>
          <Bubble text={l.text} x={l.x} y={l.y} loud w={l.w} tail="none" exit={s(l.end - l.at) - 6} />
        </Sequence>
      ))}
      {camOn && <Sequence from={s(LOUD2)} durationInFrames={s(160.32 - LOUD2)}><Foogii name="07_05_surprised_cheeks" x={540} y={1180} size={760} /></Sequence>}
      {camOn && lyr && <Sequence from={s(lyr[0])} durationInFrames={s(lyr[1] - lyr[0])} key={lyr[0]}><Caption text={lyr[2]} /></Sequence>}
      {camOn && <Viewfinder selfie={selfie} zoom={t > 10.98 && t < DROP1 ? 1 + (t - 10.98) / (DROP1 - 10.98) : 1} boot={s(0.25)} saved={s(LOUD3) - 4} label={t > 10.98 && t < DROP1 ? 'FOKUS…' : undefined} />}
      {/* kamera yoqilishi: qorong‘idan ochilish */}
      <AbsoluteFill style={{ background: '#000', opacity: interpolate(t, [0, 0.6], [1, 0], { extrapolateRight: 'clamp' }), pointerEvents: 'none' }} />
      <AbsoluteFill style={{ background: VOLT, opacity: fl * 0.85, mixBlendMode: 'screen' }} />
      <Sequence from={s(LOUD3)}><EndCard /></Sequence>
      <AbsoluteFill style={{ background: '#000', opacity: interpolate(t, [183.6, 184.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }} />
    </AbsoluteFill>
  );
};

