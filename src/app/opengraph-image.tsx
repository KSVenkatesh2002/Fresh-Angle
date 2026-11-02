import { ImageResponse } from 'next/og';
import { siteConfig } from '@/config/site';


export const alt = `${siteConfig.name} - ${siteConfig.tagline}`;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image(): Promise<ImageResponse> {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
          background: 'radial-gradient(circle at 20% 20%, #1e1b4b 0%, #0f172a 50%, #090d16 100%)',
          fontFamily: 'sans-serif',
          color: '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '28px',
              fontWeight: 800,
            }}
          >
            ✦
          </div>
          <span style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.5px' }}>
            {siteConfig.name}
          </span>
          <span
            style={{
              marginLeft: '12px',
              padding: '6px 14px',
              borderRadius: '9999px',
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#60a5fa',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '0.5px',
            }}
          >
            DAILY AI INTEL
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h1
            style={{
              fontSize: '56px',
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: '-1.5px',
              color: '#f8fafc',
              maxWidth: '1000px',
            }}
          >
            {siteConfig.tagline}
          </h1>
          <p
            style={{
              fontSize: '22px',
              color: '#94a3b8',
              lineHeight: 1.4,
              maxWidth: '850px',
            }}
          >
            Autonomous synthesis of frontier AI research, machine learning breakthroughs, and industry developments.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            paddingTop: '28px',
          }}
        >
          <span style={{ fontSize: '18px', color: '#64748b' }}>
            freshangle.vercel.app
          </span>
          <span style={{ fontSize: '16px', color: '#3b82f6', fontWeight: 600 }}>
            Read Daily Briefings →
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
