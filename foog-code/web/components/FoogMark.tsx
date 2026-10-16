// FOOG logotipi – FoogMark.dc.html dan aynan ko‘chirilgan geometriya. O‘ZGARTIRMANG.
import { useId, type CSSProperties } from 'react';

type Props = {
  kind?: 'wordmark' | 'symbol';
  ink?: string;
  primary?: string;
  accent?: string;
  fCorner?: 'curved' | 'sharp';
  dot?: boolean;
  style?: CSSProperties;
  className?: string;
  title?: string;
};

export default function FoogMark({ kind = 'wordmark', ink = '#0d1226', primary = '#c8f53a', accent = '#3d6bff', fCorner = 'curved', dot = true, style, className, title = 'FOOG' }: Props) {
  const uid = useId().replace(/:/g, '');
  const sym = kind === 'symbol';
  const curved = fCorner === 'curved';
  const gId = `g${uid}`, oId = `o${uid}`;
  return (
    <svg viewBox={sym ? '114 0 240 120' : '0 0 482 120'} style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible', ...style }} className={className} role="img" aria-label={title}>
      <defs>
        <mask id={gId}>
          <path d="M428 0 H480 V120 H428 A60 60 0 0 1 428 0 Z" fill="white" />
          <path d="M428 22 H458 V98 H428 A38 38 0 0 1 428 22 Z" fill="black" />
          <rect x="450" y="22" width="40" height="34" fill="black" />
          <rect x="440" y="56" width="40" height="22" fill="white" />
        </mask>
        <mask id={oId}>
          <path d="M174 0 H229 V120 H174 A60 60 0 0 1 174 0 Z" fill="white" />
          <path d="M174 22 H207 V98 H174 A38 38 0 0 1 174 22 Z" fill="black" />
          <path d="M294 0 H239 V120 H294 A60 60 0 0 0 294 0 Z" fill="white" />
          <path d="M294 22 H261 V98 H294 A38 38 0 0 0 294 22 Z" fill="black" />
          <circle cx="234" cy="60" r="20" fill="black" />
        </mask>
      </defs>
      <g display={sym ? 'none' : 'inline'}>
        <path display={curved ? 'inline' : 'none'} d="M0 120 V60 A60 60 0 0 1 60 0 H100 V22 H60 A38 38 0 0 0 22 60 V120 Z" fill={ink} />
        <path display={curved ? 'none' : 'inline'} d="M0 120 V0 H100 V22 H22 V120 Z" fill={ink} />
        <rect x="22" y="56" width="54" height="22" fill={ink} />
        <rect x="360" y="0" width="122" height="120" fill={ink} mask={`url(#${gId})`} />
      </g>
      <rect x="110" y="0" width="250" height="120" fill={primary} mask={`url(#${oId})`} />
      <circle cx="234" cy="60" r={dot ? 11 : 0} fill={accent} />
    </svg>
  );
}
