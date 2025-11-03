import { ImageResponse } from 'next/og';
import { MyloLogo } from '@/components/logos/mylo-logo';

// Route segment config
export const runtime = 'edge';
export const size = {
  width: 512,
  height: 512,
};
export const contentType = 'image/png';

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <MyloLogo width={400} height={400} color="#ffffff" />
      </div>
    ),
    {
      ...size,
    }
  );
}
