import { useState, useRef, useCallback, useEffect } from "react";
import { ImageCropModal } from "@/components/ImageCropModal";

interface PhotoUploadProps {
  value?: string | null;
  onChange: (blob: Blob | null) => void;
  label?: string;
}

export function PhotoUpload({ value, onChange, label = "Ingrese la foto de perfil" }: PhotoUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);

  // Sync previewUrl when value prop changes (e.g. after data loads)
  useEffect(() => {
    if (value && !previewUrl) {
      setPreviewUrl(value);
    }
  }, [value]);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setCropModalOpen(true);
      };
      reader.readAsDataURL(file);
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setCropModalOpen(true);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  const handleCropSave = (croppedBlob: Blob) => {
    const url = URL.createObjectURL(croppedBlob);
    setPreviewUrl(url);
    onChange(croppedBlob);
  };

  const handleClick = () => {
    if (previewUrl) {
      // If there's already an image, open crop modal to edit
      setSelectedImage(previewUrl);
      setCropModalOpen(true);
    } else {
      // Otherwise, open file picker
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      
      <div
        className="relative w-full h-48 bg-muted rounded-lg cursor-pointer overflow-hidden flex items-center justify-center"
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <p className="text-muted-foreground text-center px-4">
            Haz click o arrastra una imagen para continuar
          </p>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      <ImageCropModal
        open={cropModalOpen}
        onClose={() => {
          setCropModalOpen(false);
          setSelectedImage(null);
        }}
        onSave={handleCropSave}
        currentImage={selectedImage}
      />
    </div>
  );
}
