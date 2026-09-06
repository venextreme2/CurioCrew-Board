import { useRef, useState } from "react";

async function compressImage(file, maxSide = 1400, quality = 0.82) {
  if (!file?.type?.startsWith("image/")) {
    throw new Error("Можно загружать только изображения");
  }

  const bitmap = await createImageBitmap(file);

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.toDataURL("image/webp", quality);
}

export default function ImageDropField({ value = "", onChange }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file) {
    if (!file) return;

    try {
      setError("");
      const dataUrl = await compressImage(file);
      onChange(dataUrl);
    } catch (e) {
      setError(e.message || "Не удалось загрузить изображение");
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label style={{ color: "#d8ddd8", fontSize: 15 }}>
        Картинка
      </label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          minHeight: 120,
          border: `1px dashed ${dragging ? "#e1ad35" : "#4c5d53"}`,
          borderRadius: 12,
          background: dragging ? "#182019" : "#0d1410",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          overflow: "hidden",
          padding: 12,
          transition: "0.15s ease",
        }}
      >
        {value ? (
          <img
            src={value}
            alt=""
            style={{
              width: "100%",
              maxHeight: 260,
              objectFit: "cover",
              borderRadius: 8,
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              textAlign: "center",
              color: "#9ca8a0",
              lineHeight: 1.45,
            }}
          >
            <strong style={{ color: "#e8eee9" }}>
              Перетащи картинку сюда
            </strong>
            <br />
            или нажми, чтобы выбрать файл
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      <input
        type="text"
        value={value?.startsWith("data:image/") ? "" : value}
        placeholder="Или вставь ссылку на картинку"
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: "#0b110d",
          color: "#fff",
          border: "1px solid #53645a",
          borderRadius: 10,
          padding: "12px 14px",
          outline: "none",
          fontSize: 15,
        }}
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          style={{
            justifySelf: "start",
            border: "1px solid #4b5a51",
            background: "#27312b",
            color: "#f0b2a8",
            borderRadius: 9,
            padding: "8px 12px",
            cursor: "pointer",
          }}
        >
          Удалить картинку
        </button>
      )}

      {error && (
        <div style={{ color: "#ff7878", fontSize: 13 }}>{error}</div>
      )}
    </div>
  );
}
