'use client';

import * as React from 'react';
import { useCallback, useState } from 'react';
import { Camera, Loader2, X, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadApi } from '@/lib/api';
import { toast } from 'sonner';

interface PhotoUploaderProps {
  entityType: 'students' | 'staff' | 'admissions' | 'organization';
  entityId: string;
  currentPhotoUrl?: string | null;
  onUploadComplete?: (url: string, key: string) => void;
  onRemove?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
}

const sizeClasses = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
};

export function PhotoUploader({
  entityType,
  entityId,
  currentPhotoUrl,
  onUploadComplete,
  onRemove,
  size = 'md',
  className,
  disabled = false,
}: PhotoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [_progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl ?? null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      // Validate file
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Invalid file type. Please upload JPEG, PNG, WebP, or GIF.');
        return;
      }

      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        toast.error('File too large. Maximum size is 2MB.');
        return;
      }

      setUploading(true);
      setProgress(0);

      // Show preview immediately
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      try {
        const response = await uploadApi.uploadImage(entityType, entityId, file, 'photo', (p) =>
          setProgress(p)
        );

        if (response.success && response.data) {
          toast.success('Photo uploaded successfully');
          onUploadComplete?.(response.data.url, response.data.key);
        } else {
          throw new Error(response.error?.message || 'Upload failed');
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to upload photo');
        setPreviewUrl(currentPhotoUrl ?? null);
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [entityType, entityId, currentPhotoUrl, onUploadComplete]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [handleUpload]
  );

  const handleClick = useCallback(() => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click();
    }
  }, [disabled, uploading]);

  const handleRemove = useCallback(() => {
    setPreviewUrl(null);
    onRemove?.();
  }, [onRemove]);

  return (
    <div className={cn('relative inline-block', className)}>
      <div
        onClick={handleClick}
        className={cn(
          'relative rounded-full overflow-hidden border-2 border-border bg-muted cursor-pointer transition-all hover:border-primary/50 group',
          sizeClasses[size],
          (disabled || uploading) && 'opacity-50 cursor-not-allowed'
        )}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="Photo" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="w-1/2 h-1/2 text-muted-foreground" />
          </div>
        )}

        {/* Overlay */}
        {!uploading && !disabled && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-6 h-6 text-white" />
          </div>
        )}

        {/* Upload progress */}
        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Remove button */}
      {previewUrl && onRemove && !uploading && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleRemove();
          }}
          className="absolute -top-1 -right-1 p-1 bg-destructive text-destructive-foreground rounded-full shadow-md hover:bg-destructive/90 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleChange}
        className="hidden"
        disabled={disabled || uploading}
      />
    </div>
  );
}
