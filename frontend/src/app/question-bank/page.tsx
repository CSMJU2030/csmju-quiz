// src/app/question-bank/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AddIcon,
  AutoAwesomeIcon,
  CsvIcon,
  DeleteIcon,
  EditIcon,
  FilterListIcon,
  HubIcon,
  LayersIcon,
  SearchIcon,
  SellIcon,
} from "@/components/icons";
import { StatCard, StatusBadge } from "@/components/game/ui";
import { DIFFICULTY_TONE } from "@/components/quiz/bank-picker-modal";
import { QuestionEditor } from "@/components/quiz/question-editor";
import { RequiredNote } from "@/components/shared/form-field";
import { SelectionBar } from "@/components/shared/selection-bar";
import { ConfirmDeleteModal, Modal } from "@/components/shared/modal";
import { ErrorAlert, SuccessToast } from "@/components/shared/notice";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";
import { EmptyState, LoadErrorState, PageHeader, Skeleton } from "@/components/shared/states";
import {
  iconButtonClass,
  iconDangerButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/shared/ui";
import { Can } from "@/hooks/use-current-user";
import { errorMessage, type PageMeta } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { Permission } from "@/lib/permissions";
import {
  DIFFICULTY_LABEL,
  countBankItems,
  createBankItem,
  deleteBankItems,
  importCsv,
  importFromQuizzes,
  listBankItemPage,
  upsertBankItem,
  type BankItem,
  type Difficulty,
} from "@/lib/question-bank";
import {
  DIFFICULTIES as LEVELS,
  formatTimeLimit,
  isComplete,
  validateQuestion,
} from "@/lib/question-model";
import { getQuestionTypeLabel } from "@/lib/utils";

const SEARCH_DELAY_MS = 300;
/** จำนวนโจทย์ที่แสดงในกล่องยืนยันการลบหลายข้อ ที่เหลือสรุปเป็น "และอีก n ข้อ" */
const DELETE_PREVIEW_LIMIT = 5;

export default function QuestionBankPage() {
  const [items, setItems] = useState<BankItem[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [totalInBank, setTotalInBank] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tag, setTag] = useState("");
  const [level, setLevel] = useState<Difficulty | "">("");
  /** แท็กที่เคยเห็นในหน้าที่โหลดมา — ใช้เป็นตัวช่วยเติมคำในช่องแท็ก (backend ไม่มีรายการแท็กรวม) */
  const [knownTags, setKnownTags] = useState<string[]>([]);
  /** คำถามที่เลือก — เก็บทั้งก้อนเพื่อแสดงโจทย์ในกล่องยืนยันการลบ */
  const [picked, setPicked] = useState<BankItem[]>([]);
  const [toast, setToast] = useState("");
  const [actionError, setActionError] = useState("");
  const clearToast = useCallback(() => setToast(""), []);
  const [editing, setEditing] = useState<BankItem | null>(null);
  const [deleting, setDeleting] = useState<BankItem[] | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [loadError, setLoadError] = useState<unknown>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => setReload((n) => n + 1), []);

  // หน่วงการค้นหาและช่องแท็ก ไม่ยิงคำขอทุกตัวอักษร · เปลี่ยนตัวกรอง → กลับหน้า 1
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(keyword.trim());
      setTag(tagInput.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [keyword, tagInput]);

  // ตัวกรองหรือหน้าเปลี่ยน → ล้างการเลือก เพื่อไม่ให้ลบรายการที่มองไม่เห็นอยู่บนจอ
  useEffect(() => {
    const timer = window.setTimeout(() => setPicked([]), 0);
    return () => window.clearTimeout(timer);
  }, [search, tag, level, page]);

  // ค้นหา กรอง และแบ่งหน้าที่ backend (ui-design-system.md ข้อ 8.2 · ค่าเริ่มต้น 20 รายการต่อหน้า)
  useEffect(() => {
    let cancelled = false;
    listBankItemPage({ page, limit: PAGE_SIZE, search, tag, difficulty: level })
      .then(({ data, meta: next }) => {
        if (cancelled) return;
        // หน้าที่เลือกเกินจำนวนหน้าจริง (เช่น ลบรายการสุดท้ายของหน้า) → ถอยกลับหน้าสุดท้าย
        if (data.length === 0 && next.page > 1 && next.totalPages > 0) {
          setPage(next.totalPages);
          return;
        }
        setItems(data);
        setMeta(next);
        setLoadError(null);
        // เก็บเฉพาะรายการที่ยังอยู่บนหน้านี้ไว้ในการเลือก
        const onPage = new Set(data.map((i) => i.id));
        setPicked((current) => {
          const keep = new Set(current.map((i) => i.id));
          return data.filter((i) => keep.has(i.id) && onPage.has(i.id));
        });
        setKnownTags((current) =>
          Array.from(new Set([...current, ...data.flatMap((i) => i.tags)].filter(Boolean))).sort(
            (a, b) => a.localeCompare(b, "th"),
          ),
        );
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [page, search, tag, level, reload]);

  // จำนวนทั้งคลัง (ไม่ขึ้นกับตัวกรอง)
  useEffect(() => {
    let cancelled = false;
    countBankItems()
      .then((n) => {
        if (!cancelled) setTotalInBank(n);
      })
      .catch(() => {
        if (!cancelled) setTotalInBank(null);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  /** ทำงานกับ backend ทีละคำสั่ง แล้วโหลดคลังใหม่ */
  const run = async (task: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      setToast(await task());
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const list = items ?? [];
  const hasFilters = search !== "" || tag !== "" || level !== "";
  const pickedIds = new Set(picked.map((i) => i.id));

  const clearFilters = () => {
    setKeyword("");
    setSearch("");
    setTagInput("");
    setTag("");
    setLevel("");
    setPage(1);
  };

  const toggle = (item: BankItem) =>
    setPicked((p) =>
      p.some((x) => x.id === item.id) ? p.filter((x) => x.id !== item.id) : [...p, item],
    );

  const handleCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      void run(async () => {
        const n = await importCsv(String(reader.result ?? ""));
        return `นำเข้า ${formatNumber(n)} คำถามจากไฟล์ CSV แล้ว`;
      });
    };
    reader.readAsText(file, "utf-8");
  };

  const handleDeleteConfirm = async () => {
    // กันกด Enter/คลิกซ้ำ · ปิดกล่องเมื่อคำขอเสร็จ
    if (!deleting || deleteBusy) return;
    const ids = deleting.map((d) => d.id);
    setDeleteBusy(true);
    setActionError("");
    try {
      await deleteBankItems(ids);
      setToast(`ลบคำถาม ${formatNumber(ids.length)} ข้อแล้ว`);
    } catch (err) {
      setActionError(`ลบคำถามไม่สำเร็จ: ${errorMessage(err)}`);
    } finally {
      setPicked((p) => p.filter((x) => !ids.includes(x.id)));
      setDeleting(null);
      setDeleteBusy(false);
      refresh();
    }
  };

  const shownDeletes = (deleting ?? []).slice(0, DELETE_PREVIEW_LIMIT);
  const hiddenDeletes = (deleting?.length ?? 0) - shownDeletes.length;

  return (
    <div className="space-y-8 pb-28">
      <PageHeader
        title="คลังคำถามกลาง"
        description="เก็บคำถามที่ใช้ซ้ำได้ ติดแท็กและระดับความยาก แล้วกด “เพิ่มจากคลัง” ในหน้าแก้ไขแบบทดสอบเพื่อคัดลอกไปใช้"
        action={
          <Can permission={Permission.QUESTION_BANK_MANAGE_OWN}>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCsv(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className={secondaryButtonClass}
            >
              <CsvIcon className="h-4 w-4" />
              นำเข้าไฟล์ CSV
            </button>
            <button
              type="button"
              onClick={() =>
                void run(async () => {
                  const n = await importFromQuizzes();
                  return n ? `ดึงเข้าคลัง ${formatNumber(n)} คำถาม` : "ไม่มีคำถามใหม่ให้ดึง";
                })
              }
              disabled={busy}
              aria-busy={busy}
              className={secondaryButtonClass}
            >
              <AutoAwesomeIcon className="h-4 w-4" />
              ดึงจากแบบทดสอบที่มี
            </button>
            <button
              type="button"
              onClick={() => setEditing(createBankItem())}
              className={primaryButtonClass}
            >
              <AddIcon className="h-4 w-4" />
              เพิ่มคำถาม
            </button>
          </Can>
        }
      />

      <ErrorAlert message={actionError} onClose={() => setActionError("")} />

      <section aria-label="สถิติคลังคำถาม" className="grid gap-6 md:grid-cols-2">
        <StatCard
          icon={LayersIcon}
          label="คำถามในคลัง"
          value={totalInBank === null ? "–" : formatNumber(totalInBank)}
        />
        <StatCard
          icon={FilterListIcon}
          label={hasFilters ? "ตรงกับตัวกรอง" : "แสดงทั้งหมด"}
          value={meta ? formatNumber(meta.total) : "–"}
          tone="neutral"
        />
      </section>

      <section
        aria-label="ตัวกรอง"
        className="flex flex-col gap-4 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-6 py-5 shadow-sm lg:flex-row lg:items-start"
      >
        <div className="flex-1 space-y-2">
          <label htmlFor="bank-search" className={labelClass}>
            ค้นหา
          </label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant" />
            <input
              id="bank-search"
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="ข้อความในโจทย์"
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>
        <div className="space-y-2 lg:w-56">
          <label htmlFor="bank-tag" className={labelClass}>
            แท็ก
          </label>
          <input
            id="bank-tag"
            type="search"
            list="bank-tag-options"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="ทุกแท็ก · เลือกจากรายการได้"
            className={inputClass}
          />
          <datalist id="bank-tag-options">
            {knownTags.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div className="space-y-2 lg:w-48">
          <label htmlFor="bank-level" className={labelClass}>
            ระดับความยาก
          </label>
          <select
            id="bank-level"
            value={level}
            onChange={(e) => {
              setLevel(e.target.value as Difficulty | "");
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">ทุกระดับ</option>
            {LEVELS.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABEL[d]}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section aria-labelledby="bank-list-heading" className="space-y-6">
        <h2 id="bank-list-heading" className="sr-only">
          รายการคำถาม
        </h2>
        {loadError ? (
          <LoadErrorState error={loadError} onRetry={refresh} />
        ) : items === null ? (
          <div role="status" aria-live="polite" className="space-y-3">
            <span className="sr-only">กำลังโหลดคำถาม...</span>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : list.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={SearchIcon}
              title="ค้นหาแล้วไม่พบคำถาม"
              description="ลองเปลี่ยนคำค้นหา แท็ก หรือระดับความยาก"
              action={
                <button type="button" className={secondaryButtonClass} onClick={clearFilters}>
                  ล้างตัวกรอง
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={HubIcon}
              title="ยังไม่มีคำถามในคลัง"
              description="เพิ่มคำถามใหม่ หรือดึงคำถามจากแบบทดสอบที่มีอยู่เพื่อสร้างคลังได้ทันที"
              action={
                <Can permission={Permission.QUESTION_BANK_MANAGE_OWN}>
                  <button
                    type="button"
                    onClick={() => setEditing(createBankItem())}
                    className={secondaryButtonClass}
                  >
                    <AddIcon className="h-4 w-4" />
                    เพิ่มคำถาม
                  </button>
                </Can>
              }
            />
          )
        ) : (
          <>
            <ul className="space-y-3">
              {list.map((item) => {
                const active = pickedIds.has(item.id);
                const checkboxId = `pick-${item.id}`;
                const title = item.prompt || "ยังไม่มีโจทย์";
                return (
                  <li
                    key={item.id}
                    className={`flex items-start gap-4 rounded-xl border bg-surface-container-lowest p-4 shadow-sm ${
                      active ? "border-accent" : "border-outline-variant/40"
                    }`}
                  >
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={active}
                      onChange={() => toggle(item)}
                      className="mt-1 h-5 w-5 shrink-0 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor={checkboxId}
                        className="block cursor-pointer text-body-md font-medium text-on-surface"
                      >
                        {title}
                      </label>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusBadge tone="info">{getQuestionTypeLabel(item.type)}</StatusBadge>
                        {!isComplete(item) && <StatusBadge tone="warning">ยังไม่ครบ</StatusBadge>}
                        <StatusBadge tone={DIFFICULTY_TONE[item.difficulty]}>
                          {DIFFICULTY_LABEL[item.difficulty]}
                        </StatusBadge>
                        <span className="rounded-lg bg-surface-variant px-2.5 py-1 text-label-sm text-on-surface-variant tabular-nums">
                          {formatNumber(item.options.length)} ตัวเลือก ·{" "}
                          {formatTimeLimit(item.timeLimit)} · {formatNumber(item.points)} คะแนน
                        </span>
                        {item.tags.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 rounded-full bg-primary-container/10 px-2.5 py-1 text-label-sm text-primary-container"
                          >
                            <SellIcon className="h-4 w-4" />
                            {t}
                          </span>
                        ))}
                        {item.usedCount > 0 && (
                          <span className="text-label-sm text-secondary tabular-nums">
                            ใช้ไปแล้ว {formatNumber(item.usedCount)} ครั้ง
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(item)}
                        className={iconButtonClass}
                        aria-label={`แก้ไข ${title}`}
                      >
                        <EditIcon className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting([item])}
                        className={iconDangerButtonClass}
                        aria-label={`ลบ ${title}`}
                      >
                        <DeleteIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {meta && <Pagination meta={meta} onPage={setPage} label="คำถาม" />}
          </>
        )}
      </section>

      <SelectionBar
        label="การกระทำกับคำถามที่เลือก"
        count={picked.length}
        unit="ข้อ"
        total={items?.length ?? 0}
        onDelete={() => setDeleting(picked)}
        onSelectAll={() => setPicked(items ?? [])}
        onClear={() => setPicked([])}
      />

      <SuccessToast message={toast} onDone={clearToast} />

      {editing && (
        <EditorModal
          item={editing}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            // ปิดกล่องเมื่อบันทึกสำเร็จเท่านั้น — ล้มเหลวให้แก้ต่อได้โดยไม่เสียสิ่งที่พิมพ์ไว้
            await upsertBankItem(v);
            setEditing(null);
            setToast("บันทึกคำถามแล้ว");
            refresh();
          }}
        />
      )}

      <ConfirmDeleteModal
        open={deleting !== null}
        title="ลบคำถามออกจากคลัง"
        itemName={
          deleting && deleting.length > 1
            ? `คำถาม ${formatNumber(deleting.length)} ข้อ`
            : `“${deleting?.[0]?.prompt || "ยังไม่มีโจทย์"}”`
        }
        consequence="จะถูกลบออกจากคลังถาวร คำถามที่นำไปใช้ในแบบทดสอบแล้วยังคงอยู่"
        confirmLabel="ลบคำถาม"
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDeleteConfirm()}
      >
        {deleting && deleting.length > 1 && (
          <>
            <ul className="mt-3 list-disc space-y-1 pl-6 text-body-md text-on-surface">
              {shownDeletes.map((d) => (
                <li key={d.id} className="line-clamp-2 wrap-break-word">
                  {d.prompt || "ยังไม่มีโจทย์"}
                </li>
              ))}
            </ul>
            {hiddenDeletes > 0 && (
              <p className="mt-2 text-body-md text-on-surface-variant">
                และอีก {formatNumber(hiddenDeletes)} ข้อ
              </p>
            )}
          </>
        )}
      </ConfirmDeleteModal>
    </div>
  );
}

function EditorModal({
  item,
  onClose,
  onSave,
}: {
  item: BankItem;
  onClose: () => void;
  onSave: (v: BankItem) => Promise<void>;
}) {
  const [draft, setDraft] = useState<BankItem>(item);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const isNew = !item.id;
  const idPrefix = `bank-${draft.id || "new"}`;
  const issueCount = Object.values(validateQuestion(draft)).filter(Boolean).length;
  /** สรุปจำนวนจุดที่ต้องแก้ — อ่านออกเสียงผ่าน aria-live (ข้อ 8.1) · หายเองเมื่อแก้ครบ */
  const errorSummary =
    showErrors && issueCount > 0 ? `ยังบันทึกไม่ได้ ต้องแก้ ${formatNumber(issueCount)} จุด` : "";

  const submit = async () => {
    if (saving) return;
    if (issueCount) {
      setShowErrors(true);
      // รอให้ช่องที่ผิดถูกทำเครื่องหมาย aria-invalid ก่อน แล้ว focus ช่องแรก
      window.setTimeout(() => {
        const first = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
        if (!first) return;
        const target =
          first instanceof HTMLInputElement ||
          first instanceof HTMLTextAreaElement ||
          first instanceof HTMLSelectElement
            ? first
            : first.getAttribute("role") === "radiogroup"
              ? first.querySelector<HTMLElement>('input[type="radio"]')
              : first.querySelector<HTMLElement>("input, textarea, select, button");
        target?.focus();
      }, 0);
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await onSave(draft);
    } catch (err) {
      setSaveError(`บันทึกไม่สำเร็จ: ${errorMessage(err)}`);
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      size="lg"
      title={isNew ? "เพิ่มคำถามเข้าคลัง" : "แก้ไขคำถามในคลัง"}
      onClose={() => {
        if (!saving) onClose();
      }}
      footerAlign="start"
      footer={
        <>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            aria-busy={saving}
            className={`${primaryButtonClass} ${saving ? "btn-loading" : ""}`}
          >
            <span className="btn-text">บันทึก</span>
            <span className="dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={secondaryButtonClass}
          >
            ยกเลิก
          </button>
        </>
      }
    >
      {!isNew && item.usedCount > 0 && (
        <p className="mb-4 rounded-lg bg-surface-container-low px-4 py-3 text-body-md text-on-surface-variant">
          คำถามนี้ถูกคัดลอกไปใช้แล้ว {item.usedCount} ครั้ง
          การแก้ไขในคลังจะไม่เปลี่ยนคำถามในแบบทดสอบเหล่านั้น
        </p>
      )}
      <div className="mb-4 space-y-3">
        <ErrorAlert message={saveError} />
        <p aria-live="polite" className={errorSummary ? "text-label-md text-error" : "sr-only"}>
          {errorSummary}
        </p>
        <RequiredNote />
      </div>
      <div ref={formRef}>
        <QuestionEditor
          idPrefix={idPrefix}
          value={draft}
          onChange={setDraft}
          showErrors={showErrors}
        />
      </div>
    </Modal>
  );
}
