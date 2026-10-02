import { ValidationError, ValidationPipe } from '@nestjs/common';
import { Errors } from './app-exception';

function flatten(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((e) => {
    const path = parent ? `${parent}.${e.property}` : e.property;
    const own = Object.values(e.constraints ?? {}).map((m) =>
      m.startsWith(e.property) ? m.replace(e.property, path) : `${path}: ${m}`,
    );
    return [...own, ...flatten(e.children ?? [], path)];
  });
}

/** body/query ไม่ผ่าน → 400 VALIDATION_ERROR พร้อม details เป็น array ของข้อความ */
export function createValidationPipe() {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    exceptionFactory: (errors) => Errors.validation(flatten(errors)),
  });
}
