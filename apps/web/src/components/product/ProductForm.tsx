"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { ImagePlus, Loader2, Save, Tag, Wallet, X } from "lucide-react";
import { Button } from "@/components/common/Button";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { FormCard } from "@/components/common/FormCard";
import { Input } from "@/components/common/Input";
import { TextArea } from "@/components/common/TextArea";
import { uploadProductImage } from "@/features/product/api";
import styles from "./ProductForm.module.css";

const MAX_IMAGES = 10;

export interface ProductFormValues {
  name: string;
  description: string;
  price: number;
  imageUrls: string[];
}

interface ProductFormProps {
  initialValues?: Partial<ProductFormValues>;
  onSubmit: (values: ProductFormValues) => Promise<void>;
  submitLabel: string;
}

export function ProductForm({ initialValues, onSubmit, submitLabel }: ProductFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [price, setPrice] = useState(initialValues?.price?.toString() ?? "");
  const [imageUrls, setImageUrls] = useState<string[]>(initialValues?.imageUrls ?? []);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadProductImage(file));
      }
      setImageUrls((prev) => [...prev, ...uploaded].slice(0, MAX_IMAGES));
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  function removeImage(url: string) {
    setImageUrls((prev) => prev.filter((u) => u !== url));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const priceNumber = Number(price);
    if (!name.trim() || !description.trim() || !Number.isInteger(priceNumber) || priceNumber < 0) {
      setError("입력값을 확인해주세요.");
      return;
    }
    if (imageUrls.length === 0) {
      setError("이미지를 최소 1장 등록해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ name, description, price: priceNumber, imageUrls });
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormCard className={styles.form}>
      <form onSubmit={handleSubmit}>
        <Input
          label="상품명"
          icon={Tag}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
        />
        <TextArea
          label="설명"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          required
        />
        <Input
          label="가격 (원)"
          icon={Wallet}
          type="number"
          min={0}
          step={1}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />

        <div className={styles.imagesField}>
          <label className={styles.label}>이미지</label>
          <div className={styles.imageGrid}>
            {imageUrls.map((url) => (
              <div key={url} className={styles.imageThumb}>
                <img src={url} alt="" />
                <button type="button" className={styles.removeButton} onClick={() => removeImage(url)}>
                  <X size={14} strokeWidth={2.5} aria-hidden />
                </button>
              </div>
            ))}
            {imageUrls.length < MAX_IMAGES && (
              <label className={styles.uploadTile}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className={styles.uploadInput}
                />
                {isUploading ? (
                  <Loader2 size={20} strokeWidth={2} className={styles.uploadSpinner} aria-hidden />
                ) : (
                  <>
                    <ImagePlus size={20} strokeWidth={1.75} aria-hidden />
                    <span>추가</span>
                  </>
                )}
              </label>
            )}
          </div>
        </div>

        <ErrorMessage>{error}</ErrorMessage>

        <Button type="submit" icon={Save} disabled={isSubmitting || isUploading}>
          {isSubmitting ? "저장 중..." : submitLabel}
        </Button>
      </form>
    </FormCard>
  );
}
