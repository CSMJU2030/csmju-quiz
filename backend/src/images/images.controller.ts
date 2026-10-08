import { Controller, HttpCode, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { extractToken, SESSION_COOKIE } from '../auth/token-extractor';
import { Errors } from '../common/app-exception';
import { MAX_IMAGE_BYTES } from './image-file';
import { ImagesService, type UploadedImageFile } from './images.service';

export class UploadedImageView {
  @ApiProperty({ format: 'uuid', description: 'ส่งเป็น imageId ของคำถาม' }) id: string;
  @ApiProperty({ description: 'URL สาธารณะของไฟล์รูปบน Core Hub (ใช้แสดงตัวอย่าง)' }) url: string;
}

@ApiTags('images')
@ApiBearerAuth()
@ApiCookieAuth(SESSION_COOKIE)
@RequirePermissions(Permission.QUIZ_MANAGE_OWN, Permission.QUESTION_BANK_MANAGE_OWN)
@Controller('v1/images')
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Upload a question image to the Core Hub image service',
    description:
      'JPEG · PNG · WebP ไม่เกิน 5 MB · รูปเปิดดูได้โดยไม่ต้องล็อกอิน — ห้ามใช้กับรูปที่มีข้อมูลส่วนบุคคล',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({ type: UploadedImageView })
  @UseInterceptors(
    // เก็บในหน่วยความจำ (ไม่เขียนดิสก์) · เกินเพดาน multer ตอบ 413 เอง
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0 } }),
  )
  upload(@Req() req: Request, @UploadedFile() file: UploadedImageFile | undefined) {
    const extracted = extractToken(req);
    if (extracted.kind !== 'token') throw Errors.unauthorized();
    return this.images.upload(extracted.token, file);
  }
}
