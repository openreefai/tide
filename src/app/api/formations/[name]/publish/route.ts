import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { publishFormation } from '@/lib/publish';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;

  const auth = await verifyToken(request.headers);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const tarballFile = formData.get('tarball') as File | null;

    if (!tarballFile) {
      return NextResponse.json({ error: 'Missing tarball' }, { status: 400 });
    }

    const tarball = Buffer.from(await tarballFile.arrayBuffer());

    const result = await publishFormation({
      userId: auth.userId,
      name,
      tarball,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Publish failed';
    const status = message.includes('Not the formation owner') ? 403
      : message.includes('already published') ? 409
      : message.includes('reserved') ? 403
      : message.includes('does not contain reef.json') ? 400
      : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
