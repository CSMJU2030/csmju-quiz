import { AppException } from '../common/app-exception';
import type { AppConfig } from '../config/app-config.service';
import { MAX_IMAGE_BYTES, sniffImage } from './image-file';
import { displayImageUrl, storedImage } from './image-url';
import { ImagesService } from './images.service';

const ID = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1');
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

const config = {
  get: (key: string) =>
    ({ CORE_HUB_URL: 'https://hub.test/', SUBSYSTEM_ID: 'csmju-quiz' })[key] as never,
} as unknown as AppConfig;

function reply(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

describe('image helpers', () => {
  it('sniffs JPEG, PNG and WebP from bytes and rejects everything else', () => {
    expect(sniffImage(JPEG)).toBe('image/jpeg');
    expect(sniffImage(PNG)).toBe('image/png');
    expect(sniffImage(WEBP)).toBe('image/webp');
    expect(sniffImage(SVG)).toBeNull();
    expect(sniffImage(Buffer.alloc(0))).toBeNull();
  });

  it('prefers the uploaded image id over a pasted link', () => {
    new ImagesService(config); // ตั้ง base URL จาก CORE_HUB_URL
    expect(storedImage({ imageId: ID, imageUrl: 'https://x/y.png' })).toEqual({
      imageId: ID,
      imageUrl: null,
    });
    expect(storedImage({ imageUrl: '' })).toEqual({ imageId: null, imageUrl: null });
    expect(displayImageUrl({ imageId: ID, imageUrl: null })).toBe(
      `https://hub.test/api/v1/images/${ID}/file`,
    );
    expect(displayImageUrl({ imageId: null, imageUrl: 'https://x/y.png' })).toBe('https://x/y.png');
  });
});

describe('ImagesService.upload', () => {
  const service = new ImagesService(config);
  const fetchMock = jest.spyOn(globalThis, 'fetch');
  afterEach(() => fetchMock.mockReset());
  afterAll(() => fetchMock.mockRestore());

  const file = (buffer: Buffer) => ({ buffer, size: buffer.length });
  const codeOf = async (p: Promise<unknown>) => {
    const err = (await p.catch((e: unknown) => e)) as AppException;
    return [err.getStatus(), err.errorCode, err.retryAfterSec];
  };

  it('forwards the file to Core Hub with the user token and returns id + url', async () => {
    fetchMock.mockResolvedValue(reply(201, { success: true, data: { id: ID } }));
    await expect(service.upload('tok', file(PNG))).resolves.toEqual({
      id: ID,
      url: `https://hub.test/api/v1/images/${ID}/file`,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://hub.test/api/v1/images');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    const form = init!.body as FormData;
    expect(form.get('category')).toBe('GENERAL');
    expect(form.get('subsystem')).toBe('csmju-quiz');
    expect((form.get('file') as Blob).type).toBe('image/png');
  });

  it('rejects missing, oversized and non-image files without calling Core Hub', async () => {
    expect(await codeOf(service.upload('tok', undefined))).toEqual([
      400,
      'VALIDATION_ERROR',
      undefined,
    ]);
    expect(await codeOf(service.upload('tok', file(SVG)))).toEqual([
      400,
      'VALIDATION_ERROR',
      undefined,
    ]);
    expect(await codeOf(service.upload('tok', { buffer: PNG, size: MAX_IMAGE_BYTES + 1 }))).toEqual(
      [400, 'VALIDATION_ERROR', undefined],
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps Core Hub failures per reference-data 7.4', async () => {
    fetchMock.mockResolvedValueOnce(reply(401, {}));
    expect(await codeOf(service.upload('tok', file(PNG)))).toEqual([
      401,
      'UNAUTHORIZED',
      undefined,
    ]);
    fetchMock.mockResolvedValueOnce(reply(403, {}));
    expect(await codeOf(service.upload('tok', file(PNG)))).toEqual([403, 'FORBIDDEN', undefined]);
    fetchMock.mockResolvedValueOnce(reply(400, {}));
    expect(await codeOf(service.upload('tok', file(PNG)))).toEqual([
      400,
      'VALIDATION_ERROR',
      undefined,
    ]);
    fetchMock.mockResolvedValueOnce(reply(429, {}, { 'retry-after': '12' }));
    expect(await codeOf(service.upload('tok', file(PNG)))).toEqual([
      503,
      'SERVICE_UNAVAILABLE',
      12,
    ]);
    fetchMock.mockResolvedValueOnce(reply(500, {}));
    expect(await codeOf(service.upload('tok', file(PNG)))).toEqual([
      503,
      'SERVICE_UNAVAILABLE',
      30,
    ]);
    fetchMock.mockResolvedValueOnce(reply(201, { success: true, data: { id: 'not-a-uuid' } }));
    expect(await codeOf(service.upload('tok', file(PNG)))).toEqual([
      503,
      'SERVICE_UNAVAILABLE',
      30,
    ]);
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect(await codeOf(service.upload('tok', file(PNG)))).toEqual([
      503,
      'SERVICE_UNAVAILABLE',
      30,
    ]);
  });
});
