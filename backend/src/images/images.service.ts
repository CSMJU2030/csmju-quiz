// อัปโหลดรูปประกอบคำถามไปบริการเก็บรูปกลางของ Core Hub (reference-data.md ข้อ 6 · 7)
//   เรียกจาก backend เท่านั้น ด้วย token ของผู้ใช้ที่ส่ง request มา · category GENERAL · subsystem = SUBSYSTEM_ID
//   เก็บแค่ id ไว้ในคำถาม — แสดงผลด้วย {CORE_HUB_URL}/api/v1/images/<id>/file (สาธารณะ)
// ใช้กับรูปที่ใครเห็นก็ได้เท่านั้น (รูปประกอบคำถาม) — ไฟล์ที่ต้องตรวจสิทธิ์ห้ามส่งมาที่นี่
import { Injectable } from '@nestjs/common';
import { Errors } from '../common/app-exception';
import { logApp } from '../common/logger';
import { AppConfig } from '../config/app-config.service';
import { MAX_IMAGE_BYTES, sniffImage } from './image-file';
import { configureImageBase, imageFileUrl } from './image-url';

/** อัปโหลดใช้เวลานานกว่าคำขอทั่วไป (5 วินาที) ตามขนาดไฟล์ */
const UPLOAD_TIMEOUT_MS = 20_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface UploadedImageFile {
  buffer: Buffer;
  size: number;
}

@Injectable()
export class ImagesService {
  constructor(private readonly config: AppConfig) {
    configureImageBase(config.get('CORE_HUB_URL'));
  }

  async upload(token: string, file: UploadedImageFile | undefined) {
    if (!file || file.size === 0) throw Errors.validation(['file is required']);
    if (file.size > MAX_IMAGE_BYTES) {
      throw Errors.validation([`file must not exceed ${MAX_IMAGE_BYTES / 1024 / 1024} MB`]);
    }
    const mime = sniffImage(file.buffer);
    if (!mime) throw Errors.validation(['file must be a JPEG, PNG or WebP image']);

    const form = new FormData();
    const ext = mime.split('/')[1];
    form.append('file', new Blob([new Uint8Array(file.buffer)], { type: mime }), `image.${ext}`);
    form.append('category', 'GENERAL');
    form.append('subsystem', this.config.get('SUBSYSTEM_ID'));

    let res: Response;
    try {
      res = await fetch(new URL('/api/v1/images', this.config.get('CORE_HUB_URL')), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      });
    } catch (err) {
      logApp('warn', 'core_hub.image_upload.failure', { reason: (err as Error).name });
      throw Errors.serviceUnavailable(30);
    }

    if (res.ok) {
      const body = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: { id?: unknown };
      } | null;
      const id = body?.data?.id;
      if (body?.success !== true || typeof id !== 'string' || !UUID.test(id)) {
        logApp('warn', 'core_hub.image_upload.failure', { reason: 'unexpected_response' });
        throw Errors.serviceUnavailable(30);
      }
      return { id, url: imageFileUrl(id) };
    }

    // ตัดสินจาก HTTP status (reference-data.md ข้อ 7.4)
    logApp('warn', 'core_hub.image_upload.failure', { status: res.status });
    if (res.status === 401) throw Errors.unauthorized('Core Hub session has ended');
    if (res.status === 403) throw Errors.forbidden('You do not have permission to upload images');
    if (res.status === 400 || res.status === 413 || res.status === 415) {
      throw Errors.validation(['Core Hub rejected this image']);
    }
    if (res.status === 429) {
      throw Errors.serviceUnavailable(Number(res.headers.get('retry-after')) || 60);
    }
    throw Errors.serviceUnavailable(30);
  }
}
