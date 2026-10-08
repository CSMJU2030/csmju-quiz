// รูปของคำถามมาได้ 2 แบบ (reference-data.md ข้อ 6 และ 8)
//   imageId  = id ของรูปที่อัปโหลดผ่าน Core Hub POST /images — เก็บแค่ id แล้วประกอบ URL ตอนแสดงผล
//   imageUrl = ลิงก์รูป https:// ที่ผู้สอนวางเอง
// มีได้อย่างใดอย่างหนึ่ง — ส่งทั้งคู่มา imageId ชนะ

let coreHubBase = '';

/** ตั้งครั้งเดียวตอนเปิดระบบ (ImagesService) จาก CORE_HUB_URL */
export function configureImageBase(coreHubUrl: string) {
  coreHubBase = coreHubUrl.replace(/\/+$/, '');
}

/** URL สาธารณะของไฟล์รูป — `<img src>` เรียกตรงได้โดยไม่ต้องมี token */
export function imageFileUrl(imageId: string) {
  return `${coreHubBase}/api/v1/images/${imageId}/file`;
}

/** URL สำหรับแสดงผล */
export function displayImageUrl(row: { imageId?: string | null; imageUrl?: string | null }) {
  if (row.imageId) return imageFileUrl(row.imageId);
  return row.imageUrl ?? null;
}

/** ค่าที่จะบันทึก — imageId มาก่อน · ค่าว่างเป็น null */
export function storedImage(input: { imageId?: string | null; imageUrl?: string | null }) {
  if (input.imageId) return { imageId: input.imageId, imageUrl: null };
  return { imageId: null, imageUrl: input.imageUrl || null };
}
