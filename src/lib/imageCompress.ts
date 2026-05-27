/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function compressImage(
  file: File,
  maxDimension = 1000,
  quality = 0.8
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("File is not an image"));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // Downscale calculations to keep aspect ratio
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            // Fallback to raw base64 if canvas drawing is unsupported
            resolve({
              base64: e.target?.result as string,
              mimeType: file.type
            });
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Force compression utilizing standard JPEG compression
          const base64 = canvas.toDataURL("image/jpeg", quality);
          resolve({
            base64,
            mimeType: "image/jpeg"
          });
        } catch (err) {
          // Fallback to raw base64 if anything goes wrong inside canvas process
          resolve({
            base64: e.target?.result as string,
            mimeType: file.type
          });
        }
      };

      img.onerror = () => {
        resolve({
          base64: e.target?.result as string,
          mimeType: file.type
        });
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}
