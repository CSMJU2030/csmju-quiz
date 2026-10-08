import { describe, expect, it } from "vitest";
import { imageFileProblem } from "@/lib/image-upload";
import { normalizeContent, validateQuestion, blankContent } from "@/lib/question-model";
import { imageBody } from "@/lib/quiz-store";

const ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

describe("question image", () => {
  it("accepts JPG/PNG/WebP up to 5 MB only", () => {
    expect(imageFileProblem({ type: "image/png", size: 1000 })).toBeNull();
    expect(imageFileProblem({ type: "image/webp", size: 5 * 1024 * 1024 })).toBeNull();
    expect(imageFileProblem({ type: "image/svg+xml", size: 10 })).toMatch(/JPG/);
    expect(imageFileProblem({ type: "image/gif", size: 10 })).toMatch(/JPG/);
    expect(imageFileProblem({ type: "image/jpeg", size: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/);
  });

  it("sends uploaded images as imageId and pasted links as imageUrl", () => {
    expect(imageBody({ image: "http://hub/api/v1/images/x/file", imageId: ID })).toEqual({
      imageId: ID,
      imageUrl: null,
    });
    expect(imageBody({ image: " https://x/y.png " })).toEqual({
      imageId: null,
      imageUrl: "https://x/y.png",
    });
    expect(imageBody({ image: "", imageId: ID })).toEqual({ imageId: null, imageUrl: null });
  });

  it("does not flag an uploaded image as a bad link and drops the id with the image", () => {
    const base = blankContent();
    expect(
      validateQuestion({ ...base, image: "http://localhost/f", imageId: ID }).image,
    ).toBeUndefined();
    expect(validateQuestion({ ...base, image: "http://localhost/f" }).image).toBeDefined();
    expect(normalizeContent({ ...base, image: " ", imageId: ID }).imageId).toBeUndefined();
  });
});
