// ตัวกระจายการเปลี่ยนแปลงของห้องเกม → ผู้ฟัง SSE (ภายใน process เดียว)
// ถ้าขยายหลายเครื่องในอนาคต ให้แทนด้วย PostgreSQL LISTEN/NOTIFY โดยไม่ต้องแก้ส่วนอื่น
import { Injectable } from '@nestjs/common';
import { filter, map, Subject, type Observable } from 'rxjs';

@Injectable()
export class GameHub {
  private readonly changes = new Subject<string>();

  emit(sessionId: string) {
    this.changes.next(sessionId);
  }

  on(sessionId: string): Observable<void> {
    return this.changes.pipe(
      filter((id) => id === sessionId),
      map(() => undefined),
    );
  }
}
